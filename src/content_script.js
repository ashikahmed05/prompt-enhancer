// content_script.js — minimal, stable button injector for testing + production

console.log("Prompt Enhancer content script loaded.");

const BUTTON_CLASS = "prompt-enhancer-btn-v1";

/**
 * Creates the floating Enhance button.
 */
function createEnhanceButton() {
  const btn = document.createElement("button");
  btn.className = BUTTON_CLASS;
  btn.innerText = "Enhance ✨";

  Object.assign(btn.style, {
    position: "absolute",
    zIndex: 2147483647,
    padding: "6px 10px",
    fontSize: "12px",
    borderRadius: "6px",
    background: "#4b6bff",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
  });

  return btn;
}

/**
 * Attaches the Enhance button to any textarea / input / contenteditable element.
 */
function attachButtonToInput(el) {
  if (el.__promptEnhancerAttached) return; 
  el.__promptEnhancerAttached = true;

  const btn = createEnhanceButton();
  document.body.appendChild(btn);

  function positionButton() {
    const r = el.getBoundingClientRect();
    btn.style.top = `${window.scrollY + r.top + 8}px`;
    btn.style.left = `${window.scrollX + r.right - btn.offsetWidth - 8}px`;
  }

  // Initial placement
  positionButton();

  // Reposition on scroll/resize
  window.addEventListener("scroll", positionButton);
  window.addEventListener("resize", positionButton);

  // Click → send prompt to service worker
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();

    const text = el.value || el.innerText || "";
    if (!text.trim()) {
      alert("Type something first before enhancing.");
      return;
    }

    if (!confirm("Your prompt will be sent to Gemini for enhancement. Continue?")) return;

    btn.disabled = true;
    btn.innerText = "Enhancing…";

    try {
      const response = await chrome.runtime.sendMessage({
        type: "ENHANCE_PROMPT",
        prompt: text
      });

      if (response.error) {
        alert("Error: " + response.error);
      } else if (response.enhanced) {
        if ("value" in el) el.value = response.enhanced;
        else el.innerText = response.enhanced;
      }
    } catch (err) {
      console.error(err);
      alert("Enhancer Error: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Enhance ✨";
    }
  });
}

/**
 * Scans the page for input fields and attaches buttons.
 */
function scanForInputs() {
  const fields = document.querySelectorAll(
    "textarea, input[type='text'], [contenteditable='true']"
  );

  fields.forEach((el) => {
    if (el.offsetWidth < 80 || el.offsetHeight < 25) return;
    attachButtonToInput(el);
  });
}

// Initial scan
scanForInputs();

// Watch future DOM changes (for ChatGPT / Gemini dynamic UIs)
const observer = new MutationObserver(scanForInputs);
observer.observe(document.body, { childList: true, subtree: true });

