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
    divider: "#2a2a2a",
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
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #2a2a2a",
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
