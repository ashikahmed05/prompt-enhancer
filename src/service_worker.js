// service_worker.js — keeps decrypted key in memory while service worker is alive
// Receives messages from content script to enhance prompt and from popup to unlock the key.


let cachedApiKey = null; // kept in worker memory only
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-1.0'; // pick appropriate model; update per Google docs


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
if (msg.type === 'UNLOCK_KEY') {
cachedApiKey = msg.key;
sendResponse({ ok: true });
return true;
}
if (msg.type === 'ENHANCE_PROMPT') {
(async () => {
try {
if (!cachedApiKey) { sendResponse({ error: 'Key locked. Unlock via extension popup.' }); return; }
const prompt = msg.prompt;
// Build a robust enhancement instruction with structured output request
const systemInstructions = `You are a professional prompt engineer. Enhance the user's prompt to maximize clarity, constraints, and reproducible output when sending to LLMs. Return a JSON object with keys: enhanced_prompt (string), rationale (short string), examples (array of strings). The enhanced_prompt should include: role, goal, constraints, output_format, and an explicit example if applicable.`;


const body = {
// modern Gemini REST body shape (see Google docs); adjust model as needed
"contents": [
{ "role": "system", "parts": [{ "text": systemInstructions }] },
{ "role": "user", "parts": [{ "text": prompt }] }
],
"temperature": 0.2,
"maxOutputTokens": 800
};


const url = `${GEMINI_BASE}/${encodeURIComponent(DEFAULT_MODEL)}:generateContent`;
const resp = await fet
