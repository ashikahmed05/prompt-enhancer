document.addEventListener("DOMContentLoaded", () => {
  // Check if the key is already saved
  chrome.runtime.sendMessage({ type: "GET_API_KEY" }, (response) => {
    if (response && response.apiKey) {
      document.getElementById("enter-key-view").style.display = "none";
      document.getElementById("key-saved-view").style.display = "block";
    } else {
      document.getElementById("enter-key-view").style.display = "block";
      document.getElementById("key-saved-view").style.display = "none";
    }
  });
});

document.getElementById("saveKey").addEventListener("click", async () => {
  const key = document.getElementById("apiKey").value.trim();

  if (!key) {
    alert("Enter your Gemini API key");
    return;
  }

  chrome.runtime.sendMessage({ type: "SET_API_KEY", key }, (res) => {
    if (res?.ok) {
      alert("Key saved!");
      document.getElementById("enter-key-view").style.display = "none";
      document.getElementById("key-saved-view").style.display = "block";
    } else {
      alert("Failed to save key");
    }
  });
});

document.getElementById("removeKey").addEventListener("click", async () => {
  chrome.runtime.sendMessage({ type: "REMOVE_API_KEY" }, (res) => {
    if (res?.ok) {
      alert("Key removed!");
      document.getElementById("enter-key-view").style.display = "block";
      document.getElementById("key-saved-view").style.display = "none";
      document.getElementById("apiKey").value = "";
    } else {
      alert("Failed to remove key");
    }
  });
});