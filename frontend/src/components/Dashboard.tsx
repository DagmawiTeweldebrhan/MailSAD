import React, { useEffect, useState } from "react";
import { useAxisStore, TrackedEmailOverview, TrackingEvent } from "../store";
import {
  LogOut,
  Key,
  Copy,
  Check,
  RefreshCw,
  Clock,
  MapPin,
  Laptop,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  User as UserIcon
} from "lucide-react";

export default function Dashboard() {
  const {
    user,
    emails,
    selectedEmail,
    fetchEmails,
    fetchEmailDetails,
    logout,
    isLoading
  } = useAxisStore();

  const [copiedKey, setCopiedKey] = useState(false);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  // Initial load and polling every 10 seconds
  useEffect(() => {
    fetchEmails();

    const interval = setInterval(() => {
      // Trigger flash effect
      setIsFlashing(true);
      fetchEmails().finally(() => {
        setTimeout(() => setIsFlashing(false), 500);
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleRowClick = async (emailId: string) => {
    setActiveEmailId(emailId);
    await fetchEmailDetails(emailId);
  };

  const copyApiKey = () => {
    if (user?.api_key) {
      navigator.clipboard.writeText(user.api_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "clicked":
        return "text-[#FF3333] border-[#FF3333]";
      case "opened":
        return "text-[#FAFAFA] border-brand-primary";
      default:
        return "text-brand-secondary border-brand-border";
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-primary flex flex-col font-mono selection:bg-brand-accent selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-brand-border py-4 px-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="text-xl font-bold tracking-tighter flex items-center gap-2">
            <span className="w-3 h-3 bg-brand-accent"></span>
            AXIS // CONTROL_PANEL
          </div>
          {/* Live Polling Indicator */}
          <div className="flex items-center gap-2 border border-brand-border px-3 py-1 bg-brand-surface text-xs">
            <span
              className={`w-2.5 h-2.5 bg-brand-accent transition-opacity duration-150 ${
                isFlashing ? "opacity-100 scale-110" : "opacity-30"
              }`}
            ></span>
            <span>AUTO_POLL_10S</span>
          </div>
        </div>

        {/* User Stats and Controls */}
        <div className="flex items-center flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2 border border-brand-border px-3 py-1.5 bg-brand-surface">
            <UserIcon size={14} className="text-brand-secondary" />
            <span className="text-brand-secondary">USER:</span>
            <span>{user?.email}</span>
          </div>

          {/* API Key Box */}
          <div className="flex items-center gap-2 border border-brand-border px-3 py-1.5 bg-brand-surface">
            <Key size={14} className="text-brand-secondary" />
            <span className="text-brand-secondary">API_KEY:</span>
            <span className="text-brand-accent font-mono truncate max-w-[120px]">
              {user?.api_key}
            </span>
            <button
              onClick={copyApiKey}
              className="text-brand-secondary hover:text-brand-primary cursor-pointer ml-1"
              title="Copy API Key to Clipboard"
            >
              {copiedKey ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>

          <button
            onClick={() => logout()}
            className="brutalist-btn flex items-center gap-2 py-1 px-4 text-xs cursor-pointer"
          >
            <LogOut size={12} />
            EXIT
          </button>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="flex-grow flex flex-col lg:flex-row border-b border-brand-border">
        {/* Email Tracking Logs Table */}
        <section className="flex-grow p-6 lg:p-8 flex flex-col gap-6 overflow-x-auto">
          <div className="flex justify-between items-center border-b border-brand-border pb-4">
            <h2 className="text-lg font-bold uppercase tracking-tight">// TRACKED_TRANSMISSIONS</h2>
            <button
              onClick={() => fetchEmails()}
              className="border border-brand-border p-1.5 bg-brand-surface text-brand-secondary hover:text-brand-primary"
              title="Refresh Data"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="min-w-full overflow-hidden border border-brand-border bg-brand-surface">
            <table className="min-w-full text-left text-xs divide-y divide-brand-border">
              <thead>
                <tr className="bg-black text-brand-secondary uppercase tracking-tight">
                  <th className="px-6 py-4 border-r border-brand-border">STATUS</th>
                  <th className="px-6 py-4 border-r border-brand-border">RECIPIENT</th>
                  <th className="px-6 py-4 border-r border-brand-border">SUBJECT</th>
                  <th className="px-6 py-4 text-center border-r border-brand-border">OPENS</th>
                  <th className="px-6 py-4 text-center border-r border-brand-border">CLICKS</th>
                  <th className="px-6 py-4">LATEST ACTIVITY (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border font-mono">
                {emails.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-brand-secondary">
                      NO TRANSMISSIONS LOGGED. USE THE CHROME EXTENSION TO INJECT TRACKING.
                    </td>
                  </tr>
                ) : (
                  emails.map((email) => (
                    <tr
                      key={email.id}
                      onClick={() => handleRowClick(email.id)}
                      className={`cursor-pointer hover:bg-black/40 transition-colors ${
                        activeEmailId === email.id ? "bg-black/60 font-bold" : ""
                      }`}
                    >
                      <td className="px-6 py-4 border-r border-brand-border whitespace-nowrap">
                        <span
                          className={`inline-block border px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest ${getStatusColor(
                            email.status
                          )}`}
                        >
                          {email.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 border-r border-brand-border text-brand-primary truncate max-w-[200px]">
                        {email.recipient_email}
                      </td>
                      <td className="px-6 py-4 border-r border-brand-border text-brand-secondary truncate max-w-[300px]">
                        {email.subject || "[No Subject]"}
                      </td>
                      <td className="px-6 py-4 text-center border-r border-brand-border font-bold">
                        {email.opens_count}
                      </td>
                      <td className="px-6 py-4 text-center border-r border-brand-border font-bold">
                        {email.clicks_count}
                      </td>
                      <td className="px-6 py-4 text-brand-secondary whitespace-nowrap">
                        {email.latest_activity ? formatDate(email.latest_activity) : "NEVER"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detailed Inspector Drawer */}
        <aside className="w-full lg:w-[450px] border-t lg:border-t-0 lg:border-l border-brand-border bg-brand-surface p-6 flex flex-col gap-6 select-text overflow-y-auto">
          <div className="border-b border-brand-border pb-4">
            <h2 className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
              <ChevronRight size={18} className="text-brand-accent" />
              INSPECTOR_PANEL
            </h2>
            <p className="text-xs text-brand-secondary mt-1">Select an email to view full tracking metrics</p>
          </div>

          {selectedEmail && activeEmailId === selectedEmail.id ? (
            <div className="flex flex-col gap-6 text-xs font-mono">
              {/* Header Info */}
              <div className="flex flex-col gap-2 border border-brand-border p-4 bg-black/40">
                <div className="text-[10px] text-brand-secondary uppercase">// HEADER_METADATA</div>
                <div className="truncate"><span className="text-brand-secondary">TO:</span> {selectedEmail.recipient_email}</div>
                <div className="truncate"><span className="text-brand-secondary">SUBJ:</span> {selectedEmail.subject || "[No Subject]"}</div>
                <div><span className="text-brand-secondary">SENT:</span> {formatDate(selectedEmail.sent_at)}</div>
                <div className="truncate"><span className="text-brand-secondary">UUID:</span> <span className="text-brand-accent text-[11px]">{selectedEmail.id}</span></div>
              </div>

              {/* Quick Embed Developer Tools */}
              <div className="flex flex-col gap-2 border border-brand-border p-4 bg-black/40">
                <div className="text-[10px] text-brand-secondary uppercase">// MANUAL_INTEGRATION_PIXEL</div>
                <pre className="p-2 border border-brand-border bg-[#050505] text-[10px] text-brand-primary overflow-x-auto whitespace-pre select-all">
                  <code>{`<img src="http://localhost:8000/track/p.gif?eid=${selectedEmail.id}" width="1" height="1" style="display:none;" />`}</code>
                </pre>
              </div>

              {/* Event Logs List */}
              <div className="flex flex-col gap-4">
                <div className="text-xs font-bold uppercase tracking-tight text-brand-secondary border-b border-brand-border pb-2">
                  // EVENTS_FEED ({selectedEmail.events.length})
                </div>

                {selectedEmail.events.length === 0 ? (
                  <div className="text-brand-secondary text-center py-6 border border-brand-border border-dashed bg-black/10">
                    NO ACTIVITY LOGGED YET.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-1">
                    {selectedEmail.events.map((event) => (
                      <div
                        key={event.id}
                        className={`border border-brand-border p-3 flex flex-col gap-2 relative ${
                          event.is_bot ? "bg-red-950/20 border-red-900/40" : "bg-black/20"
                        }`}
                      >
                        {/* Event Header */}
                        <div className="flex justify-between items-center">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
                              event.event_type === "link_click"
                                ? "text-brand-accent border-brand-accent"
                                : "text-brand-primary border-brand-primary"
                            }`}
                          >
                            {event.event_type === "link_click" ? "LINK_CLICK" : "OPENED"}
                          </span>
                          
                          {event.is_bot && (
                            <span className="flex items-center gap-1 text-[10px] text-[#FF3333] border border-[#FF3333] px-1 bg-red-950/50">
                              <AlertTriangle size={10} />
                              BOT/SCANNER
                            </span>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-1.5 text-brand-secondary text-[11px]">
                          <Clock size={12} />
                          <span>{formatDate(event.timestamp)}</span>
                        </div>

                        {/* Location / City */}
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <MapPin size={12} className="text-brand-accent" />
                          <span className="text-brand-secondary">CITY:</span>
                          <span className="text-brand-primary font-bold">{event.city || "Unknown"}</span>
                        </div>

                        {/* IP Address */}
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-brand-secondary">IP:</span>
                          <span>{event.ip_address}</span>
                        </div>

                        {/* Target URL for Clicks */}
                        {event.event_type === "link_click" && event.target_url && (
                          <div className="flex flex-col gap-1 border-t border-brand-border/40 pt-1.5 mt-1">
                            <span className="text-brand-secondary text-[10px]">REDIRECTED_URL:</span>
                            <a
                              href={event.target_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-accent hover:underline break-all flex items-center gap-1"
                            >
                              {event.target_url}
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        )}

                        {/* User Agent */}
                        <div className="flex flex-col gap-1 border-t border-brand-border/40 pt-1.5 mt-1 text-[10px] text-brand-secondary">
                          <span className="flex items-center gap-1">
                            <Laptop size={10} />
                            USER_AGENT:
                          </span>
                          <span className="break-all">{event.user_agent}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-brand-secondary text-center py-20 border border-brand-border border-dashed bg-black/10 h-full flex flex-col justify-center items-center gap-3">
              <RefreshCw size={24} className="animate-spin text-brand-border" />
              <span>SELECT AN EMAIL FROM THE GRID TO RUN TELEMETRY ANALYSIS.</span>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
