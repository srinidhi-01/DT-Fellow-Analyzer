const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { buildPrompt } = require("./prompt"); 

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
    prompt: buildPrompt(transcript),
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