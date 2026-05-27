import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { connectPowerSync } from "./db/powersync";

// Unregister stale service workers when running inside the Lovable preview
// iframe (or any cross-origin embed). A leftover SW from a previous build
// keeps serving an old index.html whose hashed JS/CSS no longer exist,
// which renders the PWA as a blank page after a deploy.
(() => {
  try {
    const isInIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const host = window.location.hostname;
    const isPreviewHost =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host.includes("lovable.app");

    if ((isPreviewHost || isInIframe) && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister().catch(() => {}));
      }).catch(() => {});
      if (window.caches?.keys) {
        caches.keys().then((names) => names.forEach((n) => caches.delete(n).catch(() => {})))
          .catch(() => {});
      }
    }
  } catch {}
})();

const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle("dark", savedTheme ? savedTheme === "dark" : prefersDark);

// Kick off PowerSync replication at startup so the local SQLite mirror
// is populated and ready when the device goes offline.
connectPowerSync().catch((e) => console.error("[powersync] boot connect failed", e));

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
