import React, { useState } from "react";
import { useAxisStore } from "../store";
import { Terminal, Shield, Zap, Target } from "lucide-react";

export default function Landing() {
  const { login, isLoading, error } = useAxisStore();
  const [emailInput, setEmailInput] = useState("");
  
  const handleDemoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    
    // Simulate a Google Auth ID for easy local/dev onboarding
    const mockGoogleId = "google_oauth_" + Math.random().toString(36).substring(2, 11);
    await login(emailInput, mockGoogleId);
  };

  const sampleTrackingPayload = {
    event_id: "721a9a8f-28be-4bb1-8e0f-563b7194cc21",
    email_recipient: "client@enterprise.com",
    subject: "Contract Review & Signoff",
    event_type: "link_click",
    target_url: "https://contracts.axis.com/s/9082",
    client_ip: "192.168.1.42",
    location: "San Francisco, CA",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    bot_detected: false,
    timestamp: "2026-06-10T20:47:32.427Z"
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-primary flex flex-col justify-between selection:bg-brand-accent selection:text-black">
      {/* Header */}
      <header className="border-b border-brand-border py-6 px-8 flex justify-between items-center">
        <div className="font-mono text-xl font-bold tracking-tighter flex items-center gap-2">
          <span className="w-3 h-3 bg-brand-accent inline-block"></span>
          AXIS TRACKER
        </div>
        <div className="font-mono text-xs text-brand-secondary">
          SYS_STATUS: ACTIVE // v1.0.0
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="py-20 px-8 border-b border-brand-border flex flex-col lg:flex-row gap-12 items-center">
          <div className="lg:w-1/2 flex flex-col gap-6">
            <h1 className="text-7xl lg:text-9xl font-bold tracking-tighter uppercase leading-none text-brand-primary">
              KNOW <br />
              <span className="text-brand-accent">WHEN.</span>
            </h1>
            <p className="text-xl lg:text-2xl text-brand-secondary leading-relaxed tracking-tight max-w-xl">
              Zero-latency pixel injection. Brutal accuracy. Advanced bot filtering. Know exactly when they read your email.
            </p>

            {/* Quick Demo Login */}
            <form onSubmit={handleDemoLogin} className="mt-8 flex flex-col gap-4 max-w-md">
              <div className="font-mono text-xs text-brand-secondary uppercase">
                // Onboard or Access Account
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="enter.email@address.com"
                  required
                  className="brutalist-input flex-grow"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="brutalist-btn-accent whitespace-nowrap"
                >
                  {isLoading ? "AUTHORIZING..." : "ACCESS DASHBOARD"}
                </button>
              </div>
              {error && (
                <div className="text-brand-accent font-mono text-xs border border-brand-accent p-2 bg-brand-accent/5">
                  ERROR: {error}
                </div>
              )}
            </form>
          </div>

          {/* Interactive Code Payload Block */}
          <div className="lg:w-1/2 w-full">
            <div className="brutalist-card bg-black flex flex-col gap-4 font-mono">
              <div className="flex justify-between items-center pb-3 border-b border-brand-border">
                <div className="flex items-center gap-2 text-brand-secondary text-xs">
                  <Terminal size={14} className="text-brand-accent" />
                  live_tracking_feed.log
                </div>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-brand-accent"></span>
                  <span className="w-2 h-2 bg-brand-secondary"></span>
                </div>
              </div>
              <pre className="text-xs text-brand-primary overflow-x-auto whitespace-pre-wrap leading-relaxed py-2 max-h-[350px]">
                <code>{JSON.stringify(sampleTrackingPayload, null, 2)}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 border-b border-brand-border divide-y md:divide-y-0 md:divide-x divide-brand-border">
          {/* Feature 1 */}
          <div className="p-12 flex flex-col gap-4">
            <div className="w-10 h-10 border border-brand-border flex items-center justify-center text-brand-accent">
              <Zap size={20} />
            </div>
            <h3 className="font-mono font-bold text-lg uppercase tracking-tight">
              Real-time Analytics
            </h3>
            <p className="text-brand-secondary text-sm leading-relaxed">
              Track openings instantly. Events are queued in Redis and saved to Postgres asynchronously. Zero page load delay.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-12 flex flex-col gap-4">
            <div className="w-10 h-10 border border-brand-border flex items-center justify-center text-brand-accent">
              <Target size={20} />
            </div>
            <h3 className="font-mono font-bold text-lg uppercase tracking-tight">
              Link Interception
            </h3>
            <p className="text-brand-secondary text-sm leading-relaxed">
              Rewrite outgoing links on the fly. Gather exact timestamps, click destinations, client locations, and browser states.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-12 flex flex-col gap-4">
            <div className="w-10 h-10 border border-brand-border flex items-center justify-center text-brand-accent">
              <Shield size={20} />
            </div>
            <h3 className="font-mono font-bold text-lg uppercase tracking-tight">
              Privacy-First Filter
            </h3>
            <p className="text-brand-secondary text-sm leading-relaxed">
              Regex bot detection flags scanners, previews, and corporate firewalls. Focus purely on real human engagements.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-8 border-t border-brand-border flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-brand-secondary">
        <div>
          © 2026 AXIS TRACKER. ALL RIGHTS RESERVED.
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-brand-primary">API_DOCS</a>
          <a href="#" className="hover:text-brand-primary">SECURITY_POLICY</a>
          <a href="#" className="hover:text-brand-primary">GITHUB_SRC</a>
        </div>
      </footer>
    </div>
  );
}
