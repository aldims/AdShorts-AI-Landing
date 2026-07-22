import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles/design-lab-theme.css";
import "./styles/global.css";
import "./styles/studio-liquid-glass.css";
import "./styles/studio-creative-console.css";
import "./styles/studio-welcome-card.css";
import "./styles/studio-header-centered-nav.css";
import "./styles/site-header-premium.css";
import "./styles/studio-prompt-refinement.css";
import "./styles/studio-scenes-glass.css";
import "./styles/studio-project-mode-switch.css";
import "./styles/studio-segment-editor-viewport.css";
import "./styles/studio-segment-editor-platform.css";
import "./styles/studio-generation-card.css";
import "./styles/responsive-premium.css";
import "./styles/studio-desktop-height-continuum.css";

const appElement = document.getElementById("app");

if (!appElement) {
  throw new Error("App root element was not found.");
}

const platformSource =
  (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
  navigator.platform ||
  navigator.userAgent ||
  "";
const isWindowsPlatform = /win/i.test(platformSource);
const isMacPlatform = /mac/i.test(platformSource) && !isWindowsPlatform;

document.documentElement.classList.toggle("platform-windows", isWindowsPlatform);
document.documentElement.classList.toggle("platform-macos", isMacPlatform);

appElement.replaceChildren();

ReactDOM.createRoot(appElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
