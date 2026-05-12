// backend/server.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { buildPrompt } = require("./prompt");
const { recoverJSON } = require("./jsonHelper"); // ← new import

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------------------
// Calls Ollama once and attempts JSON recovery on the response.
// Returns { parsed, method } or throws if Ollama itself fails.
// Keeping this as a named function makes the retry logic readable.
// ------------------------------------------------------------------
async function generateAnalysis(transcript) {
  const response = await axios.post(
    "http://localhost:11434/api/generate",
    {
      model: "llama3.2",
      prompt: buildPrompt(transcript),
      stream: false,
    }
  );

  const rawOutput = response.data.response;
  return recoverJSON(rawOutput);
}

// ------------------------------------------------------------------
// Retries generateAnalysis up to maxAttempts times.
// Only retries if JSON recovery failed — not on Ollama network errors.
// maxAttempts = 2 is intentional: one retry catches most transient
// failures without slowing down the happy path.
// ------------------------------------------------------------------
async function generateWithRetry(transcript, maxAttempts = 2) {
  let lastRaw = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await generateAnalysis(transcript);
    lastRaw = result.raw;

    if (result.parsed !== null) {
      console.log(`[analyze] JSON recovered via: ${result.method} (attempt ${attempt})`);
      return result.parsed;
    }

    console.warn(`[analyze] Attempt ${attempt} failed JSON recovery. Retrying...`);
  }

  // All attempts exhausted — return a structured error instead of crashing
  return {
    error: "Could not extract valid JSON after retries",
    raw: lastRaw,
  };
}

// ------------------------------------------------------------------
// Route: POST /analyze
// ------------------------------------------------------------------
app.post("/analyze", async (req, res) => {
  try {
    const transcript = req.body.transcript;

    if (!transcript || transcript.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Transcript is required",
      });
    }

    const analysis = await generateWithRetry(transcript);

    res.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error("[analyze] Unexpected error:", error.message);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});