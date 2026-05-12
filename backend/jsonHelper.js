// backend/jsonHelper.js
// Handles all JSON extraction and recovery from messy LLM output.
// Three layers of defense: direct parse → extract → retry.

// ------------------------------------------------------------------
// Layer 1: Direct parse
// Try the simplest thing first. If the model returned clean JSON,
// this succeeds immediately and we never need the other layers.
// ------------------------------------------------------------------
function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Layer 2: Extract then parse
// Models often wrap JSON in markdown fences or add explanation text.
// This function finds the first { and last } in the output and
// attempts to parse only that substring.
//
// Why first { and last }?
// The model might write "Here is the analysis: { ... }" or add
// trailing commentary after the closing brace. This approach is
// more robust than regex because JSON can be deeply nested.
// ------------------------------------------------------------------
function extractJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null; // No JSON-shaped content found at all
  }

  const candidate = text.slice(start, end + 1);
  return safeParseJSON(candidate);
}

// ------------------------------------------------------------------
// Layer 3: Strip known artifacts then extract
// Some models add ```json ... ``` fences or say "json\n{...}".
// This cleans those before attempting extraction.
// ------------------------------------------------------------------
function stripAndExtract(text) {
  const cleaned = text
    .replace(/```json/gi, "") // remove opening ```json fence
    .replace(/```/g, "")      // remove closing ``` fence
    .replace(/^json\s*/i, "") // remove bare "json" prefix
    .trim();

  return extractJSON(cleaned);
}

// ------------------------------------------------------------------
// Main entry point — try all three layers in order.
// Returns { parsed, method, raw } so the caller knows how it was
// recovered. This is useful for logging and debugging.
// ------------------------------------------------------------------
function recoverJSON(rawText) {
  // Layer 1: try direct parse
  const direct = safeParseJSON(rawText);
  if (direct) {
    return { parsed: direct, method: "direct", raw: rawText };
  }

  // Layer 2: try extracting the JSON block
  const extracted = extractJSON(rawText);
  if (extracted) {
    return { parsed: extracted, method: "extracted", raw: rawText };
  }

  // Layer 3: try stripping markdown artifacts first
  const stripped = stripAndExtract(rawText);
  if (stripped) {
    return { parsed: stripped, method: "stripped", raw: rawText };
  }

  // All layers failed
  return { parsed: null, method: "failed", raw: rawText };
}

module.exports = { safeParseJSON, extractJSON, recoverJSON };