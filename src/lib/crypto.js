// crypto.js — WebCrypto helpers for passphrase-based AES-GCM encrypt/decrypt
// Uses PBKDF2 to derive an AES-GCM key from a UTF-8 passphrase.


const encoder = new TextEncoder();
const decoder = new TextDecoder();


async function deriveKey(passphrase, salt, iterations = 200000) {
const baseKey = await crypto.subtle.importKey(
'raw',
encoder.encode(passphrase),
{ name: 'PBKDF2' },
false,
['deriveKey']
);


return crypto.subtle.deriveKey(
{
name: 'PBKDF2',
salt: salt,
iterations: iterations,
hash: 'SHA-256'
},
baseKey,
{ name: 'AES-GCM', length: 256 },
false,
['encrypt', 'decrypt']
);
}


async function encryptWithPassphrase(plainText, passphrase) {
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const key = await deriveKey(passphrase, salt);
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plainText));
// Return base64-encoded components
return JSON.stringify({
salt: arrayBufferToBase64(salt),
iv: arrayBufferToBase64(iv),
ciphertext: arrayBufferToBase64(ct)
});
}


async function decryptWithPassphrase(payloadJson, passphrase) {
try {
const payload = JSON.parse(payloadJson);
const salt = base64ToArrayBuffer(payload.salt);
const iv = base64ToArrayBuffer(payload.iv);
const ct = base64ToArrayBuffer(payload.ciphertext);
const key = await deriveKey(passphrase, salt);
const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
return decoder.decode(plain);
} catch (err) {
throw new Error('Decryption failed: ' + err.message);
}
}


function arrayBufferToBase64(buf) {
const bytes = new Uint8Array(buf);
let binary = '';
for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
return btoa(binary);
export { encryptWithPassphrase, decryptWithPassphrase };
