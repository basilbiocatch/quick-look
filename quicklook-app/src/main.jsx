import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { darkTheme } from "./theme";
import { AuthProvider } from "./contexts/AuthContext";
import { getBasePath } from "./utils/baseUrl";
import { initQuicklookWebsite } from "./quicklookWebsite";
import App from "./App";

initQuicklookWebsite();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <BrowserRouter basename={getBasePath()}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);

// Prevent FOUC: show body only after first paint with styles (MUI/Emotion inject on render)
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.body.classList.add("ready");
  });
});
