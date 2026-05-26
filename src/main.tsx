import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { connectPowerSync } from "./db/powersync";

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
