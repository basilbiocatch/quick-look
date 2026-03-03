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
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ScienceIcon from "@mui/icons-material/Science";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import SettingsIcon from "@mui/icons-material/Settings";
import FolderIcon from "@mui/icons-material/Folder";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import HomeIcon from "@mui/icons-material/Home";
import { getProjects } from "../api/quicklookApi";
import { getPublicAssetUrl } from "../utils/baseUrl";

export const NAV_WIDTH = 64;

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
  const isInsightsActive = Boolean(routeProjectKey && pathname.includes("/insights"));
  const isReportsActive = Boolean(routeProjectKey && pathname.includes("/reports"));
  const isAbTestsActive = Boolean(routeProjectKey && pathname.includes("/ab-tests"));
  const isAccuracyActive = Boolean(routeProjectKey && pathname.includes("/accuracy"));
  const isSettingsActive = pathname.includes("/settings");

  const selectedProject = projectKey ? projects.find((p) => p.projectKey === projectKey) : null;
  const projectInitial = selectedProject?.name ? selectedProject.name.trim().charAt(0).toUpperCase() : null;

  return (
    <Box
      component="nav"
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
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
        zIndex: 1100,
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          mb: 3,
          pb: 1,
          pt: 1,
          "@keyframes logoFloat": {
            "0%, 100%": { transform: "translate(0, 0)" },
            "12%": { transform: "translate(1px, -1px)" },
            "25%": { transform: "translate(-1px, 1px)" },
            "37%": { transform: "translate(2px, 0)" },
            "50%": { transform: "translate(0, -2px)" },
            "62%": { transform: "translate(-2px, 1px)" },
            "75%": { transform: "translate(1px, 1px)" },
            "87%": { transform: "translate(-1px, -1px)" },
          },
          "& img": {
            height: 32,
            width: 32,
            display: "block",
            animation: "logoFloat 8s ease-in-out infinite",
          },
        }}
      >
        <img src={getPublicAssetUrl("logo.png")} alt="Quicklook" />
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

      {/* Insights */}
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
        <Tooltip title="Insights" placement="right">
          <IconButton
            onClick={(e) => {
              if (projectKey) navigate(`/projects/${projectKey}/insights`);
              else setProjectMenuAnchor(e.currentTarget);
            }}
            sx={{
              ...iconButtonSx,
              ...(isInsightsActive && {
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.18)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
              }),
              "& .MuiSvgIcon-root": { fontSize: 24 },
            }}
          >
            <LightbulbIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Reports */}
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
        <Tooltip title="Reports" placement="right">
          <IconButton
            onClick={(e) => {
              if (projectKey) navigate(`/projects/${projectKey}/reports`);
              else setProjectMenuAnchor(e.currentTarget);
            }}
            sx={{
              ...iconButtonSx,
              ...(isReportsActive && {
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.18)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
              }),
              "& .MuiSvgIcon-root": { fontSize: 24 },
            }}
          >
            <AssessmentIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* A/B Tests */}
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
        <Tooltip title="A/B Tests" placement="right">
          <IconButton
            onClick={(e) => {
              if (projectKey) navigate(`/projects/${projectKey}/ab-tests`);
              else setProjectMenuAnchor(e.currentTarget);
            }}
            sx={{
              ...iconButtonSx,
              ...(isAbTestsActive && {
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.18)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
              }),
              "& .MuiSvgIcon-root": { fontSize: 24 },
            }}
          >
            <ScienceIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Accuracy */}
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
        <Tooltip title="Accuracy" placement="right">
          <IconButton
            onClick={(e) => {
              if (projectKey) navigate(`/projects/${projectKey}/accuracy`);
              else setProjectMenuAnchor(e.currentTarget);
            }}
            sx={{
              ...iconButtonSx,
              ...(isAccuracyActive && {
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.18)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
              }),
              "& .MuiSvgIcon-root": { fontSize: 24 },
            }}
          >
            <TrendingUpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Spacer to push bottom items down */}
      <Box sx={{ flex: 1, minHeight: 8 }} />

      {/* Select project - at bottom */}
      <Box sx={{ display: "flex", justifyContent: "center", py: 0.5 }}>
        <Tooltip title={selectedProject ? `${selectedProject.name} (select project)` : "Select project"} placement="right">
          <IconButton
            onClick={(e) => setProjectMenuAnchor(e.currentTarget)}
            sx={{
              ...iconButtonSx,
              position: "relative",
              ...(projectMenuAnchor && {
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.18)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
              }),
            }}
          >
            <FolderIcon sx={{ fontSize: 24 }} />
            {projectInitial && (
              <Box
                component="span"
                sx={{
                  position: "absolute",
                  bottom: 2,
                  right: 2,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  color: "background.paper",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {projectInitial}
              </Box>
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Current Project Settings - at bottom */}
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
