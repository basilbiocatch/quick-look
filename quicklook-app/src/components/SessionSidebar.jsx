import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  ListItemButton,
  ListItemText,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import FolderIcon from "@mui/icons-material/Folder";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import AllInboxIcon from "@mui/icons-material/AllInbox";
import HomeIcon from "@mui/icons-material/Home";
import { getProjects } from "../api/quicklookApi";

const segmentOptions = [
  { value: "closed", label: "Completed sessions", Icon: CheckIcon },
  { value: "active", label: "Active sessions", Icon: RadioButtonCheckedIcon },
  { value: "", label: "All sessions", Icon: AllInboxIcon },
];

export default function SessionSidebar({ projectKey, status, setStatus, onOpenFilterPanel }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [segmentSearch, setSegmentSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setProjectsLoading(true);
    getProjects()
      .then((res) => {
        if (!cancelled && res.data?.data) setProjects(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
        <img src="/logo.png" alt="" style={{ height: 24, width: 24, display: "block", flexShrink: 0 }} />
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1rem" }}>
          Quicklook
        </Typography>
      </Box>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 2.5, pb: 1, fontSize: "0.625rem", letterSpacing: "0.08em", display: "block" }}>
        SESSIONS
      </Typography>

      <ListItemButton
        onClick={() => navigate("/")}
        sx={{ borderRadius: "6px", mx: 1.5, py: 0.5, maxHeight: 45,marginBottom:1 }}
      >
        <HomeIcon sx={{ fontSize: 16, mr: 1, color: "text.secondary" }} />
        <ListItemText primary="Back to dashboard" primaryTypographyProps={{ variant: "body2", sx: { fontSize: "0.8125rem", color: "text.secondary" } }} />
      </ListItemButton>

      <TextField
        size="small"
        placeholder="Search for segments"
        value={segmentSearch}
        onChange={(e) => setSegmentSearch(e.target.value)}
        sx={{ mx: 2, mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start" sx={{ ml: 0.5 }}>
              <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            </InputAdornment>
          ),
          sx: { fontSize: "0.875rem", height: 36, "& fieldset": { borderRadius: "6px" } },
        }}
      />

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
              "&.Mui-selected": { bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" } },
            }}
          >
            {status === value && <CheckIcon sx={{ fontSize: 18, mr: 1.25 }} />}
            <Icon sx={{ fontSize: 18, mr: 1.25, opacity: status === value ? 1 : 0.7 }} />
            <ListItemText primary={label} primaryTypographyProps={{ variant: "body2", sx: { fontSize: "0.875rem" } }} />
          </ListItemButton>
        ))}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, pt: 2, pb: 0.75 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: "0.625rem", letterSpacing: "0.08em" }}>
          PROJECTS
        </Typography>
        <ChevronRightIcon sx={{ fontSize: 16, color: "text.secondary", transform: "rotate(-90deg)" }} />
      </Box>
      <Box sx={{ px: 1.5, flex: 1, minHeight: 0, overflow: "auto" }}>
        <ListItemButton onClick={() => navigate("/projects/new")} sx={{ borderRadius: "6px", py: 0, minHeight: 32 }}>
          <AddIcon sx={{ fontSize: 16, mr: 1.25, color: "text.secondary" }} />
          <ListItemText primary="Add project" primaryTypographyProps={{ variant: "body2", sx: { fontSize: "0.8125rem", color: "text.secondary" } }} />
        </ListItemButton>
        {projectsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          projects.map((project) => (
            <ListItemButton
              key={project.projectKey}
              selected={projectKey === project.projectKey}
              onClick={() => navigate(`/projects/${project.projectKey}/sessions`)}
              sx={{ borderRadius: "6px", py: 0, minHeight: 36 }}
            >
              {projectKey === project.projectKey && <CheckIcon fontSize="small" color="primary" sx={{ mr: 1.25 }} />}
              <FolderIcon sx={{ fontSize: 18, mr: 1.25, color: "text.secondary" }} />
              <ListItemText
                primary={project.name}
                secondary={project.projectKey}
                primaryTypographyProps={{ variant: "body2", sx: { fontSize: "0.875rem" } }}
                secondaryTypographyProps={{ noWrap: true, sx: { fontSize: "0.6875rem" } }}
              />
            </ListItemButton>
          ))
        )}
      </Box>

      <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider" }} />
    </Box>
  );
}
