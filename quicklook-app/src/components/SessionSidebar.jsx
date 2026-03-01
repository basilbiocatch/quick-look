import React from "react";
import {
  Box,
  Typography,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CheckIcon from "@mui/icons-material/Check";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HomeIcon from "@mui/icons-material/Home";

const segmentOptions = [
  { value: "closed", label: "Completed sessions", Icon: CheckCircleOutlineIcon },
  { value: "active", label: "Active sessions", Icon: RadioButtonCheckedIcon },
  { value: "", label: "All sessions", Icon: AutoAwesomeIcon },
];

export default function SessionSidebar({ status, setStatus }) {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        width: 280,
        minWidth: 280,
        flexShrink: 0,
        borderRight: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        boxShadow: (theme) => (theme.palette.mode === "dark" ? "4px 0 12px rgba(0,0,0,0.2)" : "2px 0 8px rgba(0,0,0,0.06)"),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.5, pt: 2.5, pb: 1 }}>
        {/* <img src="/logo.png" alt="" style={{ height: 24, width: 24, display: "block", flexShrink: 0 }} /> */}
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1rem" }}>
          Quicklook
        </Typography>
      </Box>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 2.5, pb: 1, fontSize: "0.625rem", letterSpacing: "0.08em", display: "block" }}>
        SESSIONS
      </Typography>

      <ListItemButton
        onClick={() => navigate("/")}
        sx={{ borderRadius: "6px", mx: 1.5, py: 0.5, maxHeight: 45, marginBottom: 1 }}
      >
        <HomeIcon sx={{ fontSize: 16, mr: 1, color: "text.secondary" }} />
        <ListItemText primary="Back to dashboard" primaryTypographyProps={{ variant: "body2", sx: { fontSize: "0.8125rem", color: "text.secondary" } }} />
      </ListItemButton>

      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 2.5, pb: 0.75, fontSize: "0.625rem", letterSpacing: "0.08em" }}>
        DEFAULT SEGMENTS
      </Typography>
      <Box sx={{ px: 1.5 }}>
        {segmentOptions.map(({ value, label, Icon }) => (
          <ListItemButton
            key={value === "" ? "all" : value}
            selected={status === value}
            onClick={() => setStatus(value)}
            sx={{
              borderRadius: "6px",
              py: 0,
              minHeight: 36,
              transition: "background 0.25s ease, box-shadow 0.25s ease",
              "&.Mui-selected": {
                background: "linear-gradient(135deg, rgba(190,149,250,0.45) 0%, rgba(190,149,250,0.25) 50%, rgba(147,112,219,0.35) 100%)",
                color: "#fff",
                boxShadow: "0 0 0 1px rgba(190,149,250,0.3)",
                "&:hover": { background: "linear-gradient(135deg, rgba(190,149,250,0.55) 0%, rgba(190,149,250,0.35) 100%)", color: "#fff" },
                "& .MuiListItemText-primary": { color: "#fff" },
                "& .MuiSvgIcon-root": { color: "#fff" },
              },
            }}
          >
            {status === value && <CheckIcon sx={{ fontSize: 18, mr: 1.25 }} />}
            <Icon sx={{ fontSize: 18, mr: 1.25, opacity: status === value ? 1 : 0.7 }} />
            <ListItemText primary={label} primaryTypographyProps={{ variant: "body2", sx: { fontSize: "0.875rem" } }} />
          </ListItemButton>
        ))}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }} />
      <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider" }} />
    </Box>
  );
}
