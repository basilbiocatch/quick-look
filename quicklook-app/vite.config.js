import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig(({ mode }) => {
  // Load .env so proxy target is correct (Vite may not have loaded it before config runs).
  const env = loadEnv(mode, process.cwd(), "");
  // Default to HTTPS in dev when app is served over HTTPS (e.g. https://localhost:5174) so /api proxy matches server.
  const defaultTarget = mode === "development" ? "https://localhost:3080" : "http://localhost:3080";
  const proxyTarget = env.VITE_PROXY_TARGET || env.VITE_API_BASE_URL || defaultTarget;
  const isHttpsTarget = proxyTarget.startsWith("https");

  return {
    base: env.VITE_APP_BASE || "/",
    plugins: [react(), basicSsl()],
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@emotion/react",
        "@emotion/styled",
        "@emotion/react/jsx-runtime",
        "@mui/material",
        "@mui/material/styles",
        "@mui/icons-material",
        "@mui/x-data-grid",
      ],
    },
    server: {
      port: 5174,
      https: true,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: isHttpsTarget ? false : true,
        },
      },
    },
  };
});
