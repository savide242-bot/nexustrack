import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Guard: only register SW in production, not in iframes/preview
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if ("serviceWorker" in navigator && !isInIframe && !isPreviewHost) {
  navigator.serviceWorker.register("/sw.js").catch((err) => {
    console.warn("SW registration failed:", err);
  });
} else if (isPreviewHost || isInIframe) {
  // Clean up any existing SW in preview/iframe
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(<App />);
