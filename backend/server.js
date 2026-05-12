const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

app.post("/analyze", async (req, res) => {
  try {
    const transcript = req.body.transcript;

 const response = await axios.post(
  "http://localhost:11434/api/generate",
  {
    model: "llama3.2",
    prompt: `
You are an AI evaluator for DeepThought Fellows.

Analyze the supervisor transcript carefully.

Return ONLY valid JSON.

The JSON must contain:

{
  "score": {
    "value": number,
    "label": string,
    "justification": string
  },
  "evidence": [
    {
      "quote": string,
      "signal": "positive" | "negative" | "neutral",
      "interpretation": string
    }
  ],
  "gaps": [
    {
      "dimension": string,
      "detail": string
    }
  ],
  "followUpQuestions": [
    {
      "question": string,
      "targetGap": string
    }
  ]
}

Scoring rules:
1 = Not Interested
2 = Lacks Discipline
3 = Motivated but Directionless
4 = Careless and Inconsistent
5 = Consistent Performer
6 = Reliable and Productive
7 = Problem Identifier
8 = Problem Solver
9 = Innovative and Experimental
10 = Exceptional Performer

Important distinction:
Score 6 = reliable executor.
Score 7 = identifies problems independently.

Transcript:
${transcript}
`,
    stream: false,
  }
);

  const rawOutput = response.data.response;

let parsedOutput;

try {
  parsedOutput = JSON.parse(rawOutput);
} catch (error) {
  parsedOutput = {
    error: "Invalid JSON from AI",
    raw: rawOutput,
  };
}

res.json({
  success: true,
  analysis: parsedOutput,
});

  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});