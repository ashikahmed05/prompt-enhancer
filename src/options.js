import { encryptWithPassphrase } from './lib/crypto.js';


const apiKeyEl = document.getElementById('apiKey');
const passEl = document.getElementById('passphrase');
const status = document.getElementById('status');


document.getElementById('save').addEventListener('click', async () => {
const apiKey = apiKeyEl.value.trim();
const pass = passEl.value;
if (!apiKey || !pass) { status.innerText = 'Fill both API key and passphrase.'; return; }
status.innerText = 'Encrypting…';
try {
const ct = await encryptWithPassphrase(apiKey, pass);
await chrome.storage.local.set({ encryptedGeminiKey: ct });
status.innerText = 'Encrypted key saved. Do not forget your passphrase.';
// clear sensitive fields
apiKeyEl.value = '';
passEl.value = '';
} catch (err) {
console.error(err);
status.innerText = 'Error encrypting key.';
}
});


window.addEventListener('load', async () => {
const data = await chrome.storage.local.get(['encryptedGeminiKey']);
if (data.encryptedGeminiKey) {
status.innerText = 'Encrypted key is present. To update, paste a new API key and passphrase.';
}
});
