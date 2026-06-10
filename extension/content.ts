// Axis Tracker Gmail Content Script
const TRACKER_URL = "http://localhost:8000"; // Can be changed to "https://api.axis.com" in production

// Global state for tracked compose sessions
const activeComposeSessions = new Map<HTMLElement, {
  isTrackingEnabled: boolean;
  buttonElement: HTMLButtonElement;
}>();

// Run observer to inspect compose windows
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) {
        // Look for Gmail compose window dialogs
        const composeWindows = node.querySelectorAll('div[role="dialog"]');
        composeWindows.forEach((win) => {
          if (win.querySelector('.Am.Al.editable')) {
            setupComposeWindow(win as HTMLElement);
          }
        });
        
        // Check if the node itself is a compose window
        if (node.getAttribute('role') === 'dialog' && node.querySelector('.Am.Al.editable')) {
          setupComposeWindow(node);
        }
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Check on initial load if any compose window exists
document.querySelectorAll('div[role="dialog"]').forEach((win) => {
  if (win.querySelector('.Am.Al.editable')) {
    setupComposeWindow(win as HTMLElement);
  }
});

/**
 * Injects UI elements into the Gmail compose window and registers click handlers.
 */
function setupComposeWindow(composeWin: HTMLElement) {
  const editableArea = composeWin.querySelector('.Am.Al.editable') as HTMLElement;
  if (!editableArea || activeComposeSessions.has(composeWin)) {
    return;
  }

  // Find the formatting toolbar or action container
  // Gmail's formatting toolbar wrapper is usually td.gU or div.gU.Up
  const toolbarContainer = composeWin.querySelector('.gU.Up') || composeWin.querySelector('.Hp');
  if (!toolbarContainer) {
    return;
  }

  // 1. Create Axis Brutalist Toggle Button
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.innerText = "[ AXIS: ON ]";
  toggleBtn.style.fontFamily = "'JetBrains Mono', 'Fira Code', monospace";
  toggleBtn.style.fontSize = "12px";
  toggleBtn.style.fontWeight = "bold";
  toggleBtn.style.backgroundColor = "transparent";
  toggleBtn.style.color = "#FF3333"; // Stark harsh red
  toggleBtn.style.border = "1px solid #FF3333";
  toggleBtn.style.borderRadius = "0px";
  toggleBtn.style.padding = "4px 8px";
  toggleBtn.style.cursor = "pointer";
  toggleBtn.style.marginLeft = "8px";
  toggleBtn.style.marginRight = "8px";
  toggleBtn.style.alignSelf = "center";
  toggleBtn.style.display = "inline-block";

  // Interaction Hover States (Brutalist Inversion)
  toggleBtn.addEventListener("mouseover", () => {
    toggleBtn.style.backgroundColor = "#FF3333";
    toggleBtn.style.color = "#000000";
  });
  toggleBtn.addEventListener("mouseout", () => {
    if (toggleBtn.getAttribute("data-active") === "false") {
      toggleBtn.style.backgroundColor = "transparent";
      toggleBtn.style.color = "#888888";
    } else {
      toggleBtn.style.backgroundColor = "transparent";
      toggleBtn.style.color = "#FF3333";
    }
  });

  let isTrackingEnabled = true;
  toggleBtn.setAttribute("data-active", "true");

  toggleBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    isTrackingEnabled = !isTrackingEnabled;
    if (isTrackingEnabled) {
      toggleBtn.innerText = "[ AXIS: ON ]";
      toggleBtn.style.color = "#FF3333";
      toggleBtn.style.border = "1px solid #FF3333";
      toggleBtn.setAttribute("data-active", "true");
    } else {
      toggleBtn.innerText = "[ AXIS: OFF ]";
      toggleBtn.style.color = "#888888";
      toggleBtn.style.border = "1px solid #888888";
      toggleBtn.setAttribute("data-active", "false");
    }
  });

  // Inject button into toolbar
  toolbarContainer.appendChild(toggleBtn);

  // Keep track of this compose window session
  activeComposeSessions.set(composeWin, {
    isTrackingEnabled,
    buttonElement: toggleBtn
  });

  // 2. Intercept Send Button
  // Gmail's send button usually has the class `.aoO` or is a button/div with data-tooltip="Send"
  const sendButton = composeWin.querySelector('.aoO') || composeWin.querySelector('[data-tooltip^="Send"]');
  if (sendButton) {
    let bypassIntercept = false;

    sendButton.addEventListener("click", async (e) => {
      const session = activeComposeSessions.get(composeWin);
      if (!session || !session.isTrackingEnabled) {
        return; // Normal send if Axis is OFF
      }

      if (bypassIntercept) {
        return; // Allow the send if we've already done rewriting
      }

      // Intercept the email send event
      e.preventDefault();
      e.stopPropagation();

      // Set send button to a loading/processing state
      const originalText = (sendButton as HTMLElement).innerText;
      (sendButton as HTMLElement).innerText = "PREPARING AXIS...";
      (sendButton as HTMLElement).style.opacity = "0.7";

      try {
        // Extract Recipient
        // Gmail stores recipient chips in elements with email attributes, or in input fields
        let recipient = "";
        const recipientElements = composeWin.querySelectorAll('span[email], input[name="to"], [people-id]');
        for (const el of recipientElements) {
          const emailVal = el.getAttribute("email") || (el as HTMLInputElement).value;
          if (emailVal && emailVal.includes("@")) {
            recipient = emailVal.trim();
            break;
          }
        }

        // Fallback search in editable area for headers, or search by placeholder/name
        if (!recipient) {
          const toField = composeWin.querySelector('input[placeholder="Recipients"], textarea[name="to"]');
          if (toField) {
            recipient = (toField as HTMLInputElement).value.trim();
          }
        }

        // Clean recipient from name wrappers (e.g. "John Doe <john@example.com>" -> "john@example.com")
        if (recipient.includes("<")) {
          const match = recipient.match(/<([^>]+)>/);
          if (match && match[1]) {
            recipient = match[1].trim();
          }
        }

        // Extract Subject
        const subjectBox = composeWin.querySelector('input[name="subjectbox"]') as HTMLInputElement;
        const subject = subjectBox ? subjectBox.value : "No Subject";

        if (!recipient) {
          alert("Axis Tracker Error: Recipient email address not found in compose box.");
          (sendButton as HTMLElement).innerText = originalText;
          (sendButton as HTMLElement).style.opacity = "1.0";
          return;
        }

        // 1. Get Tracking UUID from background service worker
        const registerResponse = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({
            action: "registerEmail",
            recipient_email: recipient,
            subject: subject
          }, (res) => {
            resolve(res);
          });
        });

        if (!registerResponse || !registerResponse.success) {
          throw new Error(registerResponse?.error || "Extension background failed to register email.");
        }

        const emailId = registerResponse.emailId;

        // 2. Perform Link Rewriting in Editable Area
        const links = editableArea.querySelectorAll("a");
        links.forEach((link) => {
          const href = link.getAttribute("href");
          // Only rewrite external links, ignoring mailto or internal anchors
          if (href && href.startsWith("http")) {
            // Base64 encode the destination URL
            const encodedUrl = btoa(href);
            const trackingLink = `${TRACKER_URL}/track/l?eid=${emailId}&url=${encodedUrl}`;
            link.setAttribute("href", trackingLink);
          }
        });

        // 3. Inject Pixel at the bottom of the email content
        const pixelHtml = `<img src="${TRACKER_URL}/track/p.gif?eid=${emailId}" width="1" height="1" style="display:none;" />`;
        editableArea.innerHTML = editableArea.innerHTML + pixelHtml;

        console.log(`Axis Tracker injected pixel & links successfully. Tracking ID: ${emailId}`);

        // 4. Trigger the real send action
        bypassIntercept = true;
        (sendButton as HTMLElement).innerText = originalText;
        (sendButton as HTMLElement).style.opacity = "1.0";
        (sendButton as HTMLElement).click();

      } catch (err: any) {
        console.error("Axis intercept failure:", err);
        alert(`Axis Tracker Intercept Failure: ${err.message}. Sending without tracking.`);
        // Allow fallback sending without tracking
        bypassIntercept = true;
        (sendButton as HTMLElement).innerText = originalText;
        (sendButton as HTMLElement).style.opacity = "1.0";
        (sendButton as HTMLElement).click();
      }
    }, true); // Use capture phase to intercept prior to Gmail event listeners
  }
}
