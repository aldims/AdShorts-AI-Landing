import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles/design-lab-theme.css";
import "./styles/global.css";
import "./styles/studio-liquid-glass.css";

const appElement = document.getElementById("app");

if (!appElement) {
  throw new Error("App root element was not found.");
}

appElement.replaceChildren();

ReactDOM.createRoot(appElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
