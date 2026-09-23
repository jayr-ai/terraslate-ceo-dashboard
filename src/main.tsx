import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./theme.css";
import App from "./App.tsx";

// jayr-ai.github.io/terraslate-ceo-dashboard/ is retired in favor of the
// terraslate.azdigitalph.com hub's /ceo-dashboard/ copy — per JV,
// 2026-09-23. Redirecting here (in the app's own source) rather than via
// a static index.html stub means it survives every future automated
// deploy (CI still builds + pushes to this GitHub Pages origin as
// before — that pipeline is unchanged and still powers the "Refresh
// Data" button — this just sends any visitor straight through to the
// canonical link instead of rendering the app here).
if (window.location.hostname === "jayr-ai.github.io") {
  window.location.replace(`https://terraslate.azdigitalph.com/ceo-dashboard/${window.location.search}`);
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
