import { createTheme } from "@mui/material/styles";

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#be95fa",
    },
    background: {
      default: "#0d0d0d",
      paper: "#1a1a1a",
    },
    divider: "rgba(255,255,255,0.08)",
    text: {
      primary: "#f5f5f5",
      secondary: "#888",
    },
    success: {
      main: "#22c55e",
    },
  },
  shape: {
    borderRadius: 10,
  },
  transitions: {
    duration: { shortest: 200, shorter: 250, short: 280, standard: 300, complex: 380, enteringScreen: 320, leavingScreen: 260 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(255,255,255,0.08)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
        },
      },
    },
  },
});
