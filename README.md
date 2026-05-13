# Supervisor Feedback Analyzer
**DeepThought Fellows · Internship Assignment**

Analyzes supervisor transcripts about DT Fellows and returns structured scoring, evidence, KPI mapping, gap analysis, and follow-up questions.  
Runs entirely locally — no cloud APIs, no database.

---

## 📌 What This Project Does

This system takes a supervisor transcript as input and:
- Extracts performance signals about a DT Fellow
- Assigns a **structured score (1–10)**
- Maps reasoning to **KPIs (communication, ownership, systems thinking, execution)**
- Generates:
  - Evidence snippets from transcript
  - Gap analysis (what’s missing)
  - Follow-up questions for evaluation clarity

It is designed to reduce subjective bias in performance evaluation by enforcing structured scoring rules.

---

## ⚙️ Setup

### Requirements
- Node.js 18+
- [Ollama](https://ollama.com) installed
- `llama3.1` model pulled

---

### Install

```bash
ollama pull llama3.1

cd backend
npm install
Run
# Terminal 1 — keep open
ollama serve

# Terminal 2 — keep open
cd backend
node server.js

# Then open frontend/index.html in Chrome
🧠 Architecture
backend/
  server.js      → Express API with retry logic, calls cleanAnalysis per request
  prompt.js      → DT rubric prompt, bias detection, 6 vs 7 boundary logic
  jsonHelper.js  → 3-layer JSON recovery (parse → extract → strip markdown)
  scoreMap.js    → Enforces label + band from score value (code-driven rules)

frontend/
  index.html     → Single-file UI (no build step, includes sample transcripts)
🔧 Key Engineering Decisions
1. Switched from llama3.2 to llama3.1

3B models cannot reliably follow multi-rule evaluation prompts.
Scoring was inconsistent and unstable.
Switching to llama3.1 (8B) significantly improved determinism.

2. Label and band enforced in code, not prompt

Instead of trusting the model:

Model outputs only numeric score
scoreMap.js converts score → label + band

This ensures:

scoring rules are deterministic and cannot drift

3. Two-layer prompt architecture

Separation of concerns:

Business logic layer: systems thinking, survivability, bias patterns
Scoring logic layer: boundary rules (especially 6 vs 7 split)

This makes the system easier to iterate without breaking scoring behavior.

4. Three-layer JSON recovery system

jsonHelper.js improves robustness:

Direct JSON parse
Extract JSON substring
Strip markdown + retry parse

This handles ~90% of malformed LLM outputs without failing requests.

🌐 API Contract
Endpoint
POST /analyze
Request
{
  "transcript": "Supervisor feedback text here"
}
Response
{
  "score": 7,
  "label": "Problem Identifier",
  "band": "Strong",
  "evidence": ["..."],
  "kpiMapping": {
    "ownership": 8,
    "execution": 6,
    "systemsThinking": 7
  },
  "gaps": [
    "Limited clarity on long-term ownership"
  ],
  "followUpQuestions": [
    "Can you give an example of independent system design?"
  ]
}
🧪 Test Cases
| Fellow  | Expected Output             | Trap                                           |
| ------- | --------------------------- | ---------------------------------------------- |
| Karthik | 6 — Reliable and Productive | Warm supervisor masks task-only execution      |
| Meena   | 7 — Problem Identifier      | Critical supervisor masks genuine systems work |
| Anil    | 5 — Consistent Performer    | Glowing supervisor masks zero survivability    |

⚠️ Limitations
Depends on local Ollama runtime (not cloud-scalable yet)
Output is probabilistic and may vary slightly across runs
Prompt tuning may be required for unseen transcript patterns
No persistent storage (stateless API by design)

🚀 Future Improvements
Add evaluation dashboard for comparing fellows
Store historical evaluations (DB integration)
Fine-tune model on DT-specific rubric data
Add confidence scoring for each evaluation dimension