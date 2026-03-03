import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  CircularProgress,
  Grid,
  Card,
  CardActionArea,
  CardContent,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import FolderIcon from "@mui/icons-material/Folder";
import { useAuth } from "../contexts/AuthContext";
import { getProjects } from "../api/quicklookApi";

export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getProjects()
      .then((res) => {
        if (!cancelled && res.data?.data) setProjects(res.data.data);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleLogout = () => {
    setMenuAnchor(null);
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          {/* <img src="/logo.png" alt="" style={{ height: 32, width: 32, display: "block" }} /> */}
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.25rem" }}>
            Quicklook
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
          <IconButton
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            size="small"
            sx={{ p: 0.5 }}
            aria-label="Account menu"
          >
            <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main" }}>
              {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={() => { setMenuAnchor(null); navigate("/account"); }}>
              Account
            </MenuItem>
            <MenuItem onClick={handleLogout}>Sign out</MenuItem>
          </Menu>
        </Box>
      </Box>

      <Box sx={{ flex: 1, p: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
          Your projects
        </Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {projects.map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project.projectKey}>
                <Card
                  elevation={0}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    overflow: "hidden",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      borderColor: "primary.main",
                      boxShadow: (theme) => theme.shadows[4],
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => navigate(`/projects/${project.projectKey}/sessions`)}
                    sx={{ minHeight: 160, display: "block" }}
                  >
                    <Box
                      sx={{
                        height: 100,
                        bgcolor: "action.hover",
                        background: `linear-gradient(135deg, ${"primary.main"}22 0%, ${"primary.dark"}11 100%)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FolderIcon sx={{ fontSize: 48, color: "primary.main", opacity: 0.9 }} />
                    </Box>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={600} noWrap>
                        {project.name}
                      </Typography>
                      <Box
                        component="span"
                        title={project.projectKey}
                        sx={{
                          display: "inline-block",
                          mt: 0.5,
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: "action.hover",
                          fontFamily: "monospace",
                          fontSize: "0.6875rem",
                          color: "text.secondary",
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {project.projectKey}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
            <Grid item xs={12} sm={6} md={4}>
              <Card
                elevation={0}
                sx={{
                  border: "2px dashed",
                  borderColor: "divider",
                  borderRadius: 2,
                  minHeight: 160,
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: "action.hover",
                  },
                }}
              >
                <CardActionArea
                  onClick={() => navigate("/projects/new")}
                  sx={{ minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Box sx={{ textAlign: "center", py: 2 }}>
                    <AddIcon sx={{ fontSize: 56, color: "text.secondary", mb: 1 }} />
                    <Typography variant="subtitle1" color="text.secondary" fontWeight={500}>
                      Add project
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          </Grid>
        )}
        {!loading && projects.length === 0 && (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: "center",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              mt: 2,
            }}
          >
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Create your first project to start recording sessions.
            </Typography>
            <Typography
              component="span"
              variant="body2"
              color="primary"
              sx={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => navigate("/projects/new")}
            >
              Add project
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
