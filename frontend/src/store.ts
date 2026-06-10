import { create } from "zustand";

const API_URL = "http://localhost:8000/api";

export interface User {
  id: string;
  email: string;
  api_key: string;
  created_at: string;
}

export interface TrackingEvent {
  id: string;
  email_id: string;
  event_type: "pixel_open" | "link_click";
  target_url: string | null;
  ip_address: string;
  user_agent: string;
  is_bot: boolean;
  city: string | null;
  timestamp: string;
}

export interface TrackedEmailOverview {
  id: string;
  user_id: string;
  recipient_email: string;
  subject: string | null;
  message_id: string | null;
  status: "sent" | "opened" | "clicked";
  sent_at: string;
  opens_count: number;
  clicks_count: number;
  latest_activity: string | null;
}

export interface TrackedEmailDetail {
  id: string;
  user_id: string;
  recipient_email: string;
  subject: string | null;
  message_id: string | null;
  status: "sent" | "opened" | "clicked";
  sent_at: string;
  events: TrackingEvent[];
}

interface AxisState {
  user: User | null;
  token: string | null;
  emails: TrackedEmailOverview[];
  selectedEmail: TrackedEmailDetail | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadAuth: () => void;
  login: (email: string, googleId: string) => Promise<boolean>;
  logout: () => void;
  fetchEmails: () => Promise<void>;
  fetchEmailDetails: (emailId: string) => Promise<void>;
  clearError: () => void;
}

export const useAxisStore = create<AxisState>((set, get) => ({
  user: null,
  token: null,
  emails: [],
  selectedEmail: null,
  isLoading: false,
  error: null,

  loadAuth: () => {
    const token = localStorage.getItem("axis_token");
    const userJson = localStorage.getItem("axis_user");
    if (token && userJson) {
      try {
        set({ token, user: JSON.parse(userJson) });
      } catch (e) {
        localStorage.removeItem("axis_token");
        localStorage.removeItem("axis_user");
      }
    }
  },

  login: async (email: string, googleId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, google_id: googleId }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Authentication failed.");
      }

      const data = await response.json();
      localStorage.setItem("axis_token", data.access_token);
      localStorage.setItem("axis_user", JSON.stringify(data.user));

      set({
        token: data.access_token,
        user: data.user,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("axis_token");
    localStorage.removeItem("axis_user");
    set({ user: null, token: null, emails: [], selectedEmail: null });
  },

  fetchEmails: async () => {
    const { token } = get();
    if (!token) return;
    
    set({ error: null });
    try {
      const response = await fetch(`${API_URL}/emails`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          get().logout();
          return;
        }
        throw new Error("Failed to load tracking data.");
      }

      const data = await response.json();
      set({ emails: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchEmailDetails: async (emailId: string) => {
    const { token } = get();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/emails/${emailId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load tracking log history.");
      }

      const data = await response.json();
      set({ selectedEmail: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
