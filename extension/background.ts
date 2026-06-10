// Axis Tracker Extension Background Service Worker
const BACKEND_URL = "http://localhost:8000"; // Local dev endpoint, falls back to production in prod

interface RegisterEmailMessage {
  action: "registerEmail";
  recipient_email: string;
  subject: string;
  message_id?: string;
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "registerEmail") {
    handleRegisterEmail(message)
      .then((data) => sendResponse({ success: true, emailId: data.emailId }))
      .catch((error) => {
        console.error("Error registering tracked email:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

/**
 * Ensures user is authenticated, registers the email with the Axis backend,
 * and returns the generated email ID.
 */
async function handleRegisterEmail(message: RegisterEmailMessage): Promise<{ emailId: string }> {
  let apiKey = await getStoredApiKey();
  
  if (!apiKey) {
    // Attempt Google OAuth and registration to retrieve API Key
    console.log("No API Key found. Performing Google OAuth registration...");
    apiKey = await authenticateAndRegisterUser();
  }

  // Register the email
  const response = await fetch(`${BACKEND_URL}/api/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey
    },
    body: JSON.stringify({
      recipient_email: message.recipient_email,
      subject: message.subject,
      message_id: message.message_id || ""
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to register email: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return { emailId: data.id };
}

/**
 * Fetches the API Key from chrome storage.
 */
function getStoredApiKey(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiKey"], (result) => {
      resolve(result.apiKey || null);
    });
  });
}

/**
 * Performs Google Authentication via Chrome Identity API,
 * exchanges it with the Axis backend, and stores the retrieved API Key.
 */
async function authenticateAndRegisterUser(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        return reject(new Error(chrome.runtime.lastError?.message || "Google OAuth failed to return a token"));
      }

      try {
        // Fetch user email from Google Profile API using token
        const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!profileResponse.ok) {
          throw new Error("Failed to fetch Google profile details");
        }

        const profile = await profileResponse.json();
        const email = profile.email;
        const googleId = profile.id;

        if (!email || !googleId) {
          throw new Error("Google profile missing email or ID");
        }

        // Register user at Axis Backend
        const authResponse = await fetch(`${BACKEND_URL}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, google_id: googleId })
        });

        if (!authResponse.ok) {
          throw new Error("Failed to authenticate with Axis backend");
        }

        const authData = await authResponse.json();
        const retrievedApiKey = authData.user.api_key;

        // Store details in local storage
        await new Promise<void>((res) => {
          chrome.storage.local.set({ apiKey: retrievedApiKey, email: email }, () => res());
        });

        resolve(retrievedApiKey);
      } catch (err: any) {
        reject(err);
      }
    });
  });
}
