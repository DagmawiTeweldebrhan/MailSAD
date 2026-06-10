import { useEffect } from "react";
import { useAxisStore } from "./store";
import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";

export default function App() {
  const { user, loadAuth } = useAxisStore();

  // Restore session from localStorage on app boot
  useEffect(() => {
    loadAuth();
  }, []);

  if (user) {
    return <Dashboard />;
  }

  return <Landing />;
}
