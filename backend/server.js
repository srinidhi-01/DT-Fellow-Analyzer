// backend/server.js
const express = require("express");
const cors    = require("cors");
const axios   = require("axios");

const { buildPrompt }     = require("./prompt");
const { recoverJSON }     = require("./jsonHelper");
const { enforceScoreMap } = require("./scoreMap");

const app = express();
app.use(cors());
app.use(express.json());

const VALID_KPIS = [
  "Lead Generation", "Lead Conversion", "Upselling", "Cross-selling",
  "NPS", "PAT", "TAT", "Quality",
];

function cleanAnalysis(analysis) {
  if (!analysis || analysis.error) return analysis;

  enforceScoreMap(analysis);

  if (Array.isArray(analysis.kpiMapping)) {
    analysis.kpiMapping = analysis.kpiMapping.filter(
      (k) =>
        k.kpi &&
        VALID_KPIS.includes(k.kpi) &&
        k.evidence &&
        k.evidence.trim() !== "" &&
        (k.systemOrPersonal === "system" || k.systemOrPersonal === "personal")
    );
  }

  if (Array.isArray(analysis.biasesDetected)) {
    analysis.biasesDetected = analysis.biasesDetected.filter(
      (b) => b.quote && b.quote.trim() !== ""
    );
  }

  if (Array.isArray(analysis.evidence)) {
    analysis.evidence = analysis.evidence.filter(
      (e) => e.quote && e.quote.trim() !== ""
    );
  }

  return analysis;
}

async function generateAnalysis(transcript) {
const response = await axios.post(
  "http://localhost:11434/api/generate",
  {
    model: "mistral",
    prompt: buildPrompt(transcript),
    stream: false,
    options: {
      temperature: 0,     // deterministic output — same input = same output
      seed: 42,           // fixed seed for reproducibility
    }
  }
);
  return recoverJSON(response.data.response);
}

async function generateWithRetry(transcript, maxAttempts = 2) {
  let lastRaw = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await generateAnalysis(transcript);
    lastRaw = result.raw;

    if (result.parsed !== null) {
      console.log(`[analyze] success via: ${result.method} (attempt ${attempt})`);
      return result.parsed;
    }

    console.warn(`[analyze] attempt ${attempt} failed. Retrying...`);
  }

  return { error: "Could not extract valid JSON after retries", raw: lastRaw };
}

app.post("/analyze", async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript || transcript.trim() === "") {
      return res.status(400).json({ success: false, message: "Transcript is required" });
    }

    const rawAnalysis = await generateWithRetry(transcript);
    const analysis    = cleanAnalysis(rawAnalysis);

    // This line PROVES cleanAnalysis ran — check your terminal for it
    console.log(
      `[analyze] FINAL → score: ${analysis?.score?.value} | ` +
      `label: ${analysis?.score?.label} | ` +
      `band: ${analysis?.score?.band}`
    );

    res.json({ success: true, analysis });

  } catch (error) {
    console.error("[analyze] Unexpected error:", error.message);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));