import React, { useState, useEffect } from "react";
import {
  Box,
  IconButton,
  Tooltip,
  Menu,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  CircularProgress,
} from "@mui/material";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import VideocamIcon from "@mui/icons-material/Videocam";
import SettingsIcon from "@mui/icons-material/Settings";
import FolderIcon from "@mui/icons-material/Folder";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import HomeIcon from "@mui/icons-material/Home";
import { getProjects } from "../api/quicklookApi";
import { getPublicAssetUrl } from "../utils/baseUrl";

const NAV_WIDTH = 64;

const iconButtonSx = {
  width: 40,
  height: 40,
  mx: "auto",
  color: "rgba(255,255,255,0.85)",
  "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.12)" },
  "&.Mui-selected": {
    color: "#fff",
    bgcolor: "rgba(255,255,255,0.18)",
    "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
  },
};

export default function MainNavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectKey: routeProjectKey } = useParams();
  const projectKey = routeProjectKey || null;
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectMenuAnchor, setProjectMenuAnchor] = useState(null);

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

  const onSelectProject = (key) => {
    setProjectMenuAnchor(null);
    if (key) navigate(`/projects/${key}/sessions`);
  };

  const pathname = location.pathname || "";
  const isSessionsActive = Boolean(routeProjectKey && pathname.endsWith("/sessions"));
  const isSettingsActive = pathname.includes("/settings");

  return (
    <Box
      sx={{
        width: NAV_WIDTH,
        minWidth: NAV_WIDTH,
        flexShrink: 0,
        background: "linear-gradient(180deg, #1e1b26 0%, #15121a 50%, #0d0d0d 100%)",
        borderRight: "1px solid",
        borderColor: "rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        py: 1.5,
      }}
    >
      {/* Logo */}
      <Box sx={{ display: "flex", justifyContent: "center", mb: 2, pt: 1 }}>
        <img src={getPublicAssetUrl("logo.png")} alt="Quicklook" style={{ height: 32, width: 32, display: "block" }} />
      </Box>

      {/* Home */}
      <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
        <Tooltip title="Dashboard" placement="right">
          <IconButton
            onClick={() => navigate("/")}
            sx={{
              ...iconButtonSx,
              "& .MuiSvgIcon-root": { fontSize: 22 },
            }}
          >
            <HomeIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Sessions (Camera) */}
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
        <Tooltip title="Sessions" placement="right">
          <IconButton
            onClick={(e) => {
              if (projectKey) navigate(`/projects/${projectKey}/sessions`);
              else setProjectMenuAnchor(e.currentTarget);
            }}
            sx={{
              ...iconButtonSx,
              background: isSessionsActive
                ? "linear-gradient(135deg, rgba(190,149,250,0.4) 0%, rgba(147,112,219,0.3) 50%, rgba(99,102,241,0.3) 100%)"
                : "linear-gradient(135deg, rgba(190,149,250,0.15) 0%, rgba(147,112,219,0.1) 50%, rgba(99,102,241,0.1) 100%)",
              boxShadow: isSessionsActive
                ? "0 0 20px rgba(190,149,250,0.5), 0 0 40px rgba(147,112,219,0.3), inset 0 0 20px rgba(255,255,255,0.1)"
                : "0 0 10px rgba(190,149,250,0.3), inset 0 0 10px rgba(255,255,255,0.05)",
              border: isSessionsActive
                ? "1px solid rgba(190,149,250,0.5)"
                : "1px solid rgba(190,149,250,0.2)",
              color: isSessionsActive ? "#fff" : "rgba(190,149,250,0.9)",
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: "-50%",
                left: "-50%",
                width: "200%",
                height: "200%",
                background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
                opacity: isSessionsActive ? 0.6 : 0.3,
                animation: isSessionsActive ? "pulse 3s ease-in-out infinite" : "none",
                "@keyframes pulse": {
                  "0%, 100%": {
                    transform: "scale(1)",
                    opacity: 0.6,
                  },
                  "50%": {
                    transform: "scale(1.1)",
                    opacity: 0.8,
                  },
                },
              },
              "&:hover": {
                background: "linear-gradient(135deg, rgba(190,149,250,0.5) 0%, rgba(147,112,219,0.4) 50%, rgba(99,102,241,0.4) 100%)",
                boxShadow: "0 0 25px rgba(190,149,250,0.6), 0 0 50px rgba(147,112,219,0.4), inset 0 0 25px rgba(255,255,255,0.15)",
                border: "1px solid rgba(190,149,250,0.6)",
                color: "#fff",
                transform: "scale(1.05)",
                transition: "all 0.3s ease",
              },
              "& .MuiSvgIcon-root": {
                position: "relative",
                zIndex: 1,
                filter: isSessionsActive ? "drop-shadow(0 0 8px rgba(190,149,250,0.8))" : "drop-shadow(0 0 4px rgba(190,149,250,0.5))",
                fontSize: 24,
              },
              transition: "all 0.3s ease",
            }}
          >
            <VideocamIcon sx={{ fontSize: 24 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Current Project Settings */}
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
        <Tooltip title="Project settings" placement="right">
          <span>
            <IconButton
              onClick={() => {
                if (projectKey) navigate(`/projects/${projectKey}/settings`);
              }}
              disabled={!projectKey}
              sx={{
                ...iconButtonSx,
                ...(isSettingsActive && {
                  color: "#fff",
                  bgcolor: "rgba(255,255,255,0.18)",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
                }),
                "&.Mui-disabled": { color: "rgba(255,255,255,0.35)" },
              }}
            >
              <SettingsIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Project selector */}
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
        <Tooltip title="Select project" placement="right">
          <IconButton
            onClick={(e) => setProjectMenuAnchor(e.currentTarget)}
            sx={{
              ...iconButtonSx,
              ...(projectKey && {
                color: "#fff",
                bgcolor: "rgba(190,149,250,0.25)",
                "&:hover": { bgcolor: "rgba(190,149,250,0.35)" },
              }),
            }}
          >
            <FolderIcon sx={{ fontSize: 24 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={projectMenuAnchor}
        open={Boolean(projectMenuAnchor)}
        onClose={() => setProjectMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 240,
              maxHeight: 360,
              mt: 1.5,
              ml: -0.5,
              borderRadius: 2,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
            },
          },
        }}
      >
        <ListItemButton
          onClick={() => {
            setProjectMenuAnchor(null);
            navigate("/projects/new");
          }}
          sx={{ py: 1, borderRadius: 1, mx: 0.5, mt: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <AddIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary="Add project" primaryTypographyProps={{ variant: "body2", fontWeight: 500 }} />
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
              onClick={() => onSelectProject(project.projectKey)}
              sx={{
                borderRadius: 1,
                mx: 0.5,
                py: 0.75,
                "&.Mui-selected": {
                  background: "linear-gradient(135deg, rgba(190,149,250,0.35) 0%, rgba(147,112,219,0.2) 100%)",
                  color: "#fff",
                  "& .MuiListItemText-primary": { color: "#fff" },
                  "& .MuiSvgIcon-root": { color: "#fff" },
                },
              }}
              title={project.name}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {projectKey === project.projectKey ? (
                  <CheckIcon sx={{ fontSize: 18, color: "inherit" }} />
                ) : (
                  <FolderIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={project.name}
                primaryTypographyProps={{
                  variant: "body2",
                  sx: {
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 180,
                  },
                }}
              />
            </ListItemButton>
          ))
        )}
      </Menu>
    </Box>
  );
}
