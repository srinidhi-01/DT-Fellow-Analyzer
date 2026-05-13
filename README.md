# Supervisor Feedback Analyzer
**DeepThought Fellows · Internship Assignment · Trinethra Module**

Analyzes supervisor transcripts about DT Fellows and returns structured scoring, evidence, KPI mapping, gap analysis, and follow-up questions. Runs entirely locally — no cloud APIs, no database, no deployment required.

---

## What This Project Does

DT psychology interns currently spend 45–60 minutes manually reading a supervisor transcript, extracting behavioral evidence, and mapping it to a 1–10 rubric. This tool brings that down to ~10 minutes.

The tool takes a supervisor transcript as input and produces:

- **Score (1–10)** with label, band, justification, and confidence
- **Extracted evidence** — specific quotes from the transcript tagged by signal (positive/negative/neutral), dimension, and survivability
- **Bias detection** — flags helpfulness bias, presence bias, halo effect, recency bias, and laptop bias
- **KPI mapping** — maps supervisor language to 8 DT business KPIs
- **Gap analysis** — identifies which of the 4 assessment dimensions the transcript did not cover
- **Follow-up questions** — targeted questions for the next supervisor call, each addressing a specific gap

The tool produces a **draft for the intern to review** — not a verdict. The intern accepts, edits, or rejects each finding.

---

## Setup

### Requirements

- Node.js 18+
- [Ollama](https://ollama.com) installed
- llama3.1 model pulled

### Install

```bash
# Step 1 — Pull the model (one time only, ~4.7 GB download)
ollama pull llama3.1

# Step 2 — Install backend dependencies
cd backend
npm install
```

### Run

```bash
# Terminal 1 — start Ollama (keep this open)
ollama serve

# Terminal 2 — start backend (keep this open)
cd backend
node server.js

# Then open frontend/index.html in Chrome
# No build step required — just open the file directly
```

### Test

Three sample transcripts are built into the UI. Click **Load Karthik**, **Load Meena**, or **Load Anil** to fill the textarea, then click **Analyze Transcript**.

Expected results:

| Fellow | Score | Label | Trap the tool must avoid |
|--------|-------|-------|--------------------------|
| Karthik | 6 | Reliable and Productive | Warm supervisor masks task-only execution |
| Meena | 7 | Problem Identifier | Critical supervisor masks genuine systems work |
| Anil | 5 | Consistent Performer | Glowing supervisor masks zero survivability |

---

## Model Choice

**llama3.1 (8B parameters)**

I started with llama3.2 (3B). It produced inconsistent scores — the same transcript would score 6 on one run and 9 on another. 3B models cannot reliably follow multi-rule prompts with simultaneous constraints (rubric logic, bias detection, survivability test, JSON format).

Switching to llama3.1 (8B) resolved the consistency problem. The tradeoff is speed (~30–40 seconds per analysis vs ~15 seconds) and RAM usage (~8 GB). For a tool used by interns to review transcripts one at a time, this is an acceptable tradeoff.

---

## Architecture

```
frontend/
  index.html       Single-file UI. No build step. Sample transcripts built in.

backend/
  server.js        Express API. Retry logic. Applies cleanAnalysis to every response.
  prompt.js        Ollama prompt — DT rubric, bias detection, 6 vs 7 boundary logic.
  jsonHelper.js    Three-layer JSON recovery from messy model output.
  scoreMap.js      Enforces correct label + band from score value in code.

data/
  sample-transcripts.json    The three reference transcripts from the assignment.
```

**Request flow:**

```
Browser → POST /analyze → generateWithRetry() → Ollama (llama3.1)
                                                        ↓
                                               recoverJSON()
                                                        ↓
                                               cleanAnalysis()
                                                        ↓
                                          enforceScoreMap() + filters
                                                        ↓
                                               JSON response → Browser
```

---

## Key Engineering Decisions

### 1. Label and band enforced in code, not prompt

Early versions asked the model to output the correct label and band alongside the score. The model would frequently contradict itself — `value: 6` with `label: "Problem Identifier"` (which is score 7), or `band: "Need Attention"` for a score 7.

The fix: `scoreMap.js` is a lookup table that maps score value → label + band. After every model response, `cleanAnalysis()` calls `enforceScoreMap()` which overwrites whatever the model wrote. The model is only trusted for the numeric value. Mechanical rules belong in code, not in LLM instructions.

### 2. Three-layer JSON recovery

Local models frequently produce messy output — markdown fences, explanatory text before/after the JSON, or incomplete structure. `jsonHelper.js` handles this in three layers:

1. **Direct parse** — `JSON.parse(rawText)`. Works when the model behaved.
2. **Substring extraction** — find the first `{` and last `}`, extract and parse. Handles "Here is the result: {...}" wrapping.
3. **Strip and extract** — remove ` ```json ` fences, then extract. Handles markdown output.

If all three fail, the backend retries once. This resolves ~90% of transient failures.

### 3. Prompt architecture — business logic separated from scoring rules

The prompt has 9 sections. Sections 1–3 cover business logic (the two-layer Fellow model, what counts as systems building, bias patterns). Sections 4–5 cover scoring rules (the rubric, the 6 vs 7 boundary test). Sections 6–7 cover calibration examples and KPI mapping.

This separation means I can update the bias detection logic without touching the scoring rules, and vice versa. It also made iterative prompt improvement tractable — each section is independently testable.

### 4. One prompt, not many

The assignment raises this as a design challenge. I chose one prompt over multiple sequential calls because:

- The scoring decision depends on evidence classification — you can't score without first understanding what's systems building vs execution
- Multiple calls would require passing context between them, adding coordination complexity
- With llama3.1 (8B), one well-structured prompt produces reliable results

The tradeoff is a longer prompt (~2000 tokens) and a single slow call instead of multiple fast ones. For a tool used interactively one transcript at a time, this is the right choice.

---

## Design Challenges Tackled

### Challenge 2: Structured Output Reliability

LLMs don't always return clean JSON. My approach: three-layer recovery in `jsonHelper.js` (described above), one retry on failure, and post-processing in `cleanAnalysis()` that filters out empty evidence quotes, invalid KPI entries, and empty bias entries that the model sometimes generates as placeholders.

The key insight: don't try to fix everything in the prompt. Fix what you can in code after the fact. Prompts are probabilistic; code is deterministic.

### Challenge 5: Gap Detection

Detecting what the transcript *doesn't* say is harder than extracting what it does say. My approach: the prompt defines 4 mandatory assessment dimensions (execution, systems_building, kpi_impact, change_management) and instructs the model to check each one explicitly — present or absent. The prompt also includes negative examples for each dimension (what does *not* count as systems building, what does *not* count as change management) so the model has a clear boundary to reason about.

### Challenge 4: Showing Uncertainty

The output includes a `confidence` field (high/medium/low) that is color-coded in the UI (green/yellow/red). The subtitle on the page says "Powered by local Ollama" and the score section is labeled "Score" not "Verdict". The framing matters — the tool is positioned as a draft reviewer, not an authority.

---

## API Reference

**Endpoint:** `POST /analyze`

**Request:**
```json
{ "transcript": "Supervisor feedback text here..." }
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "score": {
      "value": 7,
      "label": "Problem Identifier",
      "band": "Performance",
      "justification": "...",
      "confidence": "medium"
    },
    "biasesDetected": [
      { "type": "presence_bias", "quote": "...", "adjustment": "..." }
    ],
    "evidence": [
      {
        "quote": "...",
        "signal": "positive",
        "dimension": "systems_building",
        "survivabilityPass": false,
        "interpretation": "..."
      }
    ],
    "kpiMapping": [
      { "kpi": "TAT", "evidence": "...", "systemOrPersonal": "personal" }
    ],
    "gaps": [
      { "dimension": "change_management", "detail": "..." }
    ],
    "followUpQuestions": [
      { "question": "...", "targetGap": "change_management", "lookingFor": "..." }
    ]
  }
}
```

---

## Limitations

- Requires Ollama running locally — not deployable to a server without replacing the LLM layer
- Output varies slightly between runs — local models are probabilistic; label/band are now deterministic via `scoreMap.js` but score value can still shift by ±1
- Prompt tuned on three reference transcripts — may need adjustment for transcripts with very different styles (e.g. very short supervisor responses, non-English phrases)
- No persistent storage — each analysis is stateless; results are not saved

---

## What I'd Improve With More Time

1. **Side-by-side transcript view** — intern sees the raw transcript on the left, analysis on the right, with evidence quotes highlighted in the original text. Currently the intern has to manually find the quote to verify it.

2. **Editable analysis fields** — intern can correct the score or rewrite an evidence interpretation before finalising. This prevents automation bias (blindly accepting the AI's output) and makes the tool a genuine draft reviewer.

3. **Confidence-driven UI warnings** — when confidence is "medium" or "low", show a visible banner: "This analysis is uncertain — verify each finding before accepting." Currently confidence is shown but doesn't change the UI behaviour.

4. **Persist analyses to file** — save each completed analysis as a JSON file so interns can review past transcripts and track patterns across Fellows over time.

5. **Fine-tune on DT rubric data** — with a dataset of human-scored transcripts, fine-tune a smaller model specifically on the 6 vs 7 boundary. This is the hardest scoring decision and where the general-purpose model is least reliable.
