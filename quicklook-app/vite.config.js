import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_APP_BASE || "/",
  plugins: [react()],
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
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:3080",
        changeOrigin: true,
      },
    },
  },
});
