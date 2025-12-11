// src/service_worker.js
// FINAL SELF-HEALING VERSION
// - Uses ListModels to dynamically find valid and supported Gemini models
// - Prioritizes flash models first (2.5-flash → 2.0-flash → 2.5-pro → 2.0-pro)
// - Falls back automatically when model missing / unsupported / overloaded
// - Clean error messages

console.log("[PromptEnhancer] Service worker loaded");

let cachedApiKey = null;

// Load saved key
chrome.storage.local.get(["geminiApiKey"]).then((data) => {
  if (data.geminiApiKey) cachedApiKey = data.geminiApiKey;
});

// -------------------------
// Utility: headers
// -------------------------
function buildHeaders(key) {
  const h = { "Content-Type": "application/json" };
  if (key.startsWith("ya29.")) h["Authorization"] = `Bearer ${key}`;
  return h;
}

// -------------------------
// Utility: fetch listModels
// -------------------------
async function listModels(key) {
  const base = "https://generativelanguage.googleapis.com/v1/models";
  const url = key.startsWith("ya29.") ? base : `${base}?key=${encodeURIComponent(key)}`;
  const headers = buildHeaders(key);

  try {
    const res = await fetch(url, { method: "GET", headers });
    const raw = await res.text();
    let json = null;
    try { json = JSON.parse(raw); } catch (_) {}

    if (!res.ok) {
      console.warn("[Models] Failed:", res.status, raw);
      return [];
    }

    if (!json?.models) return [];

    // Normalize: return array of {id, supportsGenerateContent}
    return json.models.map(m => {
      const fullName = m.name; // e.g. "models/gemini-2.5-flash"
      const id = fullName.split("/").pop();

      const supports = Array.isArray(m.supportedMethods)
        ? m.supportedMethods.includes("generateContent")
        : true; // assume true if not provided

      return { id, supports };
    });

  } catch (err) {
    console.error("[Models] Error:", err);
    return [];
  }
}

// -------------------------
// Priority Model Ordering
// -------------------------
const priorityOrder = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "gemini-2.0-pro"
];

// -------------------------
// Filter + Priority Selector
// -------------------------
function pickOrderedValidModels(allModels) {
  const supported = allModels.filter(m => m.supports);

  // 1. Try priority order first (only if supported)
  const prioritized = priorityOrder
    .map(id => supported.find(m => m.id === id))
    .filter(Boolean);

  // 2. Append any remaining supported gemini models
  const rest = supported.filter(
    m => !priorityOrder.includes(m.id) && m.id.startsWith("gemini")
  );

  return [...prioritized, ...rest];
}

// -------------------------
// MAIN MESSAGE HANDLER
// -------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  // Get key
  if (msg.type === "GET_API_KEY") {
    sendResponse({ apiKey: cachedApiKey });
    return true;
  }

  // Remove key
  if (msg.type === "REMOVE_API_KEY") {
    chrome.storage.local.remove("geminiApiKey", () => {
      cachedApiKey = null;
      sendResponse({ ok: true });
    });
    return true;
  }

  // Save key
  if (msg.type === "SET_API_KEY") {
    chrome.storage.local.set({ geminiApiKey: msg.key }, () => {
      cachedApiKey = msg.key;
      sendResponse({ ok: true });
    });
    return true;
  }

  // ------------------------------
  // ENHANCE PROMPT (WITH FALLBACK)
  // ------------------------------
  if (msg.type === "ENHANCE_PROMPT") {
    const prompt = (msg.prompt || "").trim();

    if (!prompt) {
      sendResponse({ error: "The input is empty." });
      return true;
    }
    if (!cachedApiKey) {
      sendResponse({ error: "API key not found." });
      return true;
    }

    (async () => {
      // 1. Dynamically discover valid models
      const models = await listModels(cachedApiKey);
      const orderedModels = pickOrderedValidModels(models);

      if (orderedModels.length === 0) {
        sendResponse({ error: "No Gemini models supporting generateContent are available." });
        return;
      }

      // Build headers + body
      const headers = buildHeaders(cachedApiKey);
      const body = {
        contents: [{
          parts: [{
            text:
`Improve and rewrite the user’s prompt with maximum clarity, structure, and intent precision.

Analyze the original prompt to understand the user’s true goal, missing context, and constraints.  
Enhance the prompt using only the information actually provided—do NOT invent placeholders, variables, examples, or fictional data.

Incorporate the value of a professional prompt-enhancement tool by strengthening:
- clarity of intention  
- specificity of expected output  
- constraints and formatting  
- completeness and relevance  

Return ONLY the enhanced prompt as plain text. No labels, no explanations, no metadata.


User Prompt:
${prompt}`
          }]
        }]
      };

      let lastError = "All models failed.";

      // 2. Try models in order until success
      for (const model of orderedModels) {
        try {
          const url = cachedApiKey.startsWith("ya29.")
            ? `https://generativelanguage.googleapis.com/v1/models/${model.id}:generateContent`
            : `https://generativelanguage.googleapis.com/v1/models/${model.id}:generateContent?key=${encodeURIComponent(cachedApiKey)}`;

          const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body)
          });

          const raw = await res.text();
          let json = null;
          try { json = JSON.parse(raw); } catch (_) {}

          if (!res.ok) {
            const msg =
              json?.error?.message ||
              json?.error?.errors?.[0]?.message ||
              raw;

            // Overload detected → try next model
            if (
              res.status === 429 ||
              res.status === 503 ||
              (msg && msg.toLowerCase().includes("overload"))
            ) {
              console.warn(`[Fallback] Model overloaded: ${model.id}, trying next...`);
              lastError = msg;
              continue;
            }

            // Fatal configuration error → stop immediately
            if ([400, 401, 403, 404].includes(res.status)) {
              sendResponse({ error: msg, raw });
              return;
            }

            lastError = msg;
            continue;
          }

          // Extract text
          const enhanced =
            json?.candidates?.[0]?.content?.parts?.[0]?.text ||
            json?.outputText ||
            json?.choices?.[0]?.message?.content;

          if (!enhanced) {
            lastError = "Unexpected response format.";
            continue;
          }

          // SUCCESS
          sendResponse({ enhanced: enhanced.trim(), raw: json });
          return;

        } catch (err) {
          lastError = err.message;
          continue;
        }
      }

      // If all models fail
      sendResponse({ error: lastError });

    })();

    return true;
  }

  sendResponse({ error: "Unknown message type." });
  return true;
});
