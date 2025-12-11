// content_script.js — Smart button placement for LLM chat sites

console.log("Prompt Enhancer content script loaded.");

const BUTTON_CLASS = "prompt-enhancer-btn-v1";
const WRAPPER_CLASS = "prompt-enhancer-wrapper-v1"; // For fallback mode
const PROCESSED_FLAG = "__promptEnhancerAttached";

// --- Site-Specific Configurations ---
const SITE_CONFIGS = {
  "chat.openai.com": {
    // ChatGPT
    findTargetElements: () => {
      const textarea = document.querySelector("textarea#prompt-textarea");
      if (!textarea) return null;
      // The send button container is a couple of levels up and then over
      const form = textarea.closest("form");
      const sendButton = form?.querySelector('[data-testid="send-button"]');
      const container = sendButton?.parentElement;
      return container ? { input: textarea, container: container } : null;
    },
    injectionMethod: "insertBefore", // Insert before the send button
  },
  "gemini.google.com": {
    // Google Gemini
    findTargetElements: () => {
      const input = document.querySelector(".input-area .ql-editor");
      if (!input) return null;
      // Find the parent element that contains both the input and the send button
      const root = input.closest(".main-content");
      const container = root?.querySelector(".send-button-container");
      return container ? { input: input, container: container } : null;
    },
    injectionMethod: "appendChild",
  },
  "www.perplexity.ai": {
    // Perplexity
    findTargetElements: () => {
        const textarea = document.querySelector("textarea[placeholder*='Ask anything']");
        if (!textarea) return null;
        const container = textarea.parentElement?.parentElement?.querySelector('button')?.parentElement;
        return container ? { input: textarea, container: container} : null;
    },
    injectionMethod: "insertBefore"
  }
};

/**
 * Creates the Enhance button.
 * @param {boolean} isNative - True if the button should have minimal "native" styling.
 */
function createEnhanceButton(isNative = false) {
  const btn = document.createElement("button");
  btn.className = BUTTON_CLASS;
  btn.title = "Enhance Prompt";
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L11.8 9.2a1.21 1.21 0 0 0 0 1.72l5.48 5.48a1.21 1.21 0 0 0 1.72 0l6.84-6.84a1.21 1.21 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-2"/><path d="M11 3H9"/><path d="M9 17v-2"/><path d="M3 12h2"/></svg>`;
  btn.type = "button"; // Prevent form submission

  if (isNative) {
    // Minimal styling for native look. Assumes host site provides button styles.
    Object.assign(btn.style, {
      background: "transparent",
      border: "none",
      padding: "8px", // A bit of padding
      cursor: "pointer",
      color: "inherit", // Inherit color from parent
      alignSelf: "center",
    });
  } else {
    // Fallback styling for the wrapper method
    Object.assign(btn.style, {
      position: "absolute",
      zIndex: 1,
      top: "8px",
      right: "8px",
      padding: "4px",
      borderRadius: "6px",
      background: "rgba(255, 255, 255, 0.8)",
      color: "#444",
      border: "1px solid #ccc",
      cursor: "pointer",
    });
  }

  return btn;
}

/**
 * The main function to handle injecting the button on a page.
 */
function initializeEnhancer() {
  const hostname = window.location.hostname;
  const config = SITE_CONFIGS[hostname];

  if (config) {
    // --- Smart Injection Logic for Known Sites ---
    const targets = config.findTargetElements();
    if (targets && targets.container && targets.input && !targets.container[PROCESSED_FLAG]) {
        targets.container[PROCESSED_FLAG] = true;
        
        const btn = createEnhanceButton(true);
        
        if (config.injectionMethod === "insertBefore") {
            const referenceNode = targets.container.firstChild;
            targets.container.insertBefore(btn, referenceNode);
        } else {
            targets.container.appendChild(btn);
        }

        addClickHandler(btn, targets.input);
    }
  } else {
    // --- Fallback Logic for Unknown Sites ---
    const fields = document.querySelectorAll("textarea, input[type='text'], [contenteditable='true']");
    fields.forEach((el) => {
      if (el.offsetWidth < 80 || el.offsetHeight < 25) return;
      if (el[PROCESSED_FLAG] || el.closest(`.${WRAPPER_CLASS}`)) return;
      
      el[PROCESSED_FLAG] = true;
      attachButtonAsWrapper(el);
    });
  }
}

/**
 * Fallback method: wraps the input field and adds the button inside.
 * @param {HTMLElement} el - The input element.
 */
function attachButtonAsWrapper(el) {
  const wrapper = document.createElement("div");
  wrapper.className = WRAPPER_CLASS;
  wrapper.style.position = "relative";
  const elStyle = window.getComputedStyle(el);
  wrapper.style.display = elStyle.display === "inline" ? "inline-block" : elStyle.display;
  
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);

  const btn = createEnhanceButton(false);
  wrapper.appendChild(btn);

  addClickHandler(btn, el);
}

/**
 * Centralized click handler logic for the enhance button.
 * @param {HTMLButtonElement} btn - The enhance button.
 * @param {HTMLElement} inputEl - The associated input/textarea element.
 */
function addClickHandler(btn, inputEl) {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    const text = inputEl.value || inputEl.innerText || "";
    if (!text.trim()) {
      alert("Please enter some text to enhance.");
      return;
    }

    btn.disabled = true;
    const originalIcon = btn.innerHTML;
    btn.innerHTML = "⏳";
    btn.title = "Enhancing...";

    try {
      const response = await chrome.runtime.sendMessage({ type: 'ENHANCE_PROMPT', prompt: text });

      if (response && response.enhanced) {
        if ('value' in inputEl) {
          inputEl.value = response.enhanced;
        } else {
          inputEl.innerText = response.enhanced;
        }
        const event = new Event('input', { bubbles: true, cancelable: true });
        inputEl.dispatchEvent(event);
      }

      if (response && response.error) {
        alert(`Error: ${response.error}`);
      }
    } catch (err) {
      alert(`An unexpected error occurred: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalIcon;
      btn.title = "Enhance Prompt";
    }
  });
}

// --- Main Execution ---

// Use a MutationObserver to detect when chat UIs are loaded, as they are often dynamic.
const observer = new MutationObserver((mutations) => {
    // Use debounce to avoid running on every tiny DOM change
    let timeout;
    clearTimeout(timeout);
    timeout = setTimeout(initializeEnhancer, 500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial run
initializeEnhancer();
