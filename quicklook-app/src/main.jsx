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

ReactDOM.createRoot(document.getElementById("root")).render(
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
