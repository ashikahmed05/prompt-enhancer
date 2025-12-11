// popup.js — ask for passphrase, decrypt key and send it to service worker (cached in memory there)
import { decryptWithPassphrase } from './lib/crypto.js';


const passEl = document.getElementById('pass');
const msg = document.getElementById('msg');


document.getElementById('unlock').addEventListener('click', async () => {
const pass = passEl.value;
if (!pass) { msg.innerText = 'Enter passphrase'; return; }
msg.innerText = 'Unlocking…';
try {
const { encryptedGeminiKey } = await chrome.storage.local.get(['encryptedGeminiKey']);
if (!encryptedGeminiKey) { msg.innerText = 'No API key saved in options.'; return; }
const apiKey = await decryptWithPassphrase(encryptedGeminiKey, pass);
// send to service worker to cache in memory for this session
const res = await chrome.runtime.sendMessage({ type: 'UNLOCK_KEY', key: apiKey });
if (res && res.ok) {
msg.innerText = 'Unlocked for this browser session. You can close this popup.';
passEl.value = '';
} else {
msg.innerText = 'Failed to unlock. ' + (res?.error || '');
}
} catch (err) {
console.error(err);
msg.innerText = 'Decryption failed. Check passphrase.';
}
});
