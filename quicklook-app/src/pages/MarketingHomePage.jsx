import React from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import BugReportIcon from "@mui/icons-material/BugReport";
import CheckIcon from "@mui/icons-material/Check";
import { getPublicAssetUrl } from "../utils/baseUrl";

const sectionSx = {
  py: { xs: 6, md: 10 },
};

const primaryGradient = "linear-gradient(135deg, #be95fa 0%, #9370db 50%, #6366f1 100%)";

export default function MarketingHomePage() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header / Nav */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(13,13,13,0.85)",
          backdropFilter: "blur(12px)",
          animation: "headerSlideIn 0.5s ease-out",
          "@keyframes headerSlideIn": {
            "0%": { opacity: 0, transform: "translateY(-16px)" },
            "100%": { opacity: 1, transform: "translateY(0)" },
          },
          "&::after": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -1,
            height: 1,
            background: primaryGradient,
            opacity: 0,
            transition: "opacity 0.3s ease",
          },
          "&:hover::after": {
            opacity: 0.6,
          },
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 2,
            }}
          >
            <Link to="/" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 10 }}>
              <img src={getPublicAssetUrl("logo.png")} alt="Quicklook" style={{ height: 32, width: 32, display: "block" }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.25rem" }}>
                Quicklook
              </Typography>
            </Link>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Button
                component={Link}
                to="/login"
                color="inherit"
                sx={{
                  color: "text.secondary",
                  transition: "color 0.2s ease, transform 0.2s ease",
                  "&:hover": { color: "text.primary", transform: "translateY(-1px)" },
                }}
              >
                Log in
              </Button>
              <Button
                component={Link}
                to="/signup"
                variant="contained"
                sx={{
                  background: primaryGradient,
                  color: "#fff",
                  transition: "opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
                  "&:hover": {
                    opacity: 0.95,
                    background: primaryGradient,
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 20px rgba(190,149,250,0.4)",
                  },
                }}
              >
                Try Free
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero */}
      <Box component="section" sx={{ ...sectionSx, pt: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: "center", maxWidth: 720, mx: "auto" }}>
            <Typography
              component="h1"
              variant="h2"
              fontWeight={800}
              sx={{
                fontSize: { xs: "2.25rem", md: "3.5rem" },
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                mb: 2,
                textAlign: "center",
              }}
            >
              Session{" "}
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  verticalAlign: "middle",
                  mx: { xs: 0.5, md: 1 },
                  animation: "heroIconFadeIn 0.6s ease-out 0.2s both",
                  "@keyframes heroIconFadeIn": {
                    "0%": { opacity: 0, transform: "scale(0.8)" },
                    "100%": { opacity: 1, transform: "scale(1)" },
                  },
                }}
              >
                <VideocamIcon
                  sx={{
                    fontSize: "1em",
                    height: "1em",
                    color: "primary.main",
                    filter: "drop-shadow(0 0 12px rgba(190,149,250,0.4))",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    top: "2%",
                    right: "2%",
                    width: "22%",
                    height: "22%",
                    minWidth: 6,
                    minHeight: 6,
                    borderRadius: "50%",
                    bgcolor: "#ef4444",
                    animation: "livePulse 1.5s ease-in-out infinite",
                    boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.5)",
                    "@keyframes livePulse": {
                      "0%, 100%": { boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.5)" },
                      "50%": { boxShadow: "0 0 0 6px rgba(239, 68, 68, 0)" },
                    },
                  }}
                />
              </Box>
              {" "}replay &amp; DevTools,{" "}
              <Box component="span" sx={{ background: primaryGradient, backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                built for developers
              </Box>
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 4, fontWeight: 400, fontSize: { xs: "1rem", md: "1.25rem" } }}>
              See exactly what users did. Debug with session recordings and integrated DevTools — no guesswork.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
              <Button
                component={Link}
                to="/signup"
                variant="contained"
                size="large"
                sx={{
                  px: 3,
                  py: 1.5,
                  background: primaryGradient,
                  color: "#fff",
                  fontSize: "1rem",
                  "&:hover": { opacity: 0.95, background: primaryGradient },
                }}
              >
                Try Free
              </Button>
              <Button component={Link} to="/login" variant="outlined" size="large" sx={{ px: 3, py: 1.5 }}>
                Log in
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Features */}
      <Box component="section" sx={{ ...sectionSx, bgcolor: "rgba(255,255,255,0.02)" }}>
        <Container maxWidth="lg">
          <Typography component="h2" variant="h4" fontWeight={700} textAlign="center" sx={{ mb: 6 }}>
            Everything you need to understand and fix issues
          </Typography>
          <Grid container spacing={4} justifyContent="center">
            <Grid item xs={12} md={6}>
              <Card
                elevation={0}
                sx={{
                  height: "100%",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                  bgcolor: "background.paper",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    borderColor: "primary.main",
                    boxShadow: "0 8px 32px rgba(190,149,250,0.15)",
                  },
                }}
              >
                <Box
                  sx={{
                    height: 140,
                    background: "linear-gradient(135deg, rgba(190,149,250,0.2) 0%, rgba(99,102,241,0.1) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <VideocamIcon sx={{ fontSize: 56, color: "primary.main" }} />
                </Box>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Session Recording
                  </Typography>
                  <Typography color="text.secondary">
                    Capture real user sessions and replay them exactly as they happened. See clicks, scrolls, and navigation to reproduce bugs and improve UX.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card
                elevation={0}
                sx={{
                  height: "100%",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                  bgcolor: "background.paper",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    borderColor: "primary.main",
                    boxShadow: "0 8px 32px rgba(190,149,250,0.15)",
                  },
                }}
              >
                <Box
                  sx={{
                    height: 140,
                    background: "linear-gradient(135deg, rgba(190,149,250,0.2) 0%, rgba(99,102,241,0.1) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BugReportIcon sx={{ fontSize: 56, color: "primary.main" }} />
                </Box>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    DevTools
                  </Typography>
                  <Typography color="text.secondary">
                    Inspect console logs, network requests, and user context right next to the replay. Debug faster with everything in one place.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Pricing */}
      <Box component="section" sx={sectionSx} id="pricing">
        <Container maxWidth="lg">
          <Typography component="h2" variant="h4" fontWeight={700} textAlign="center" sx={{ mb: 6 }}>
            Simple, transparent pricing
          </Typography>
          <Grid container spacing={3} justifyContent="center" alignItems="stretch">
            {/* Free */}
            <Grid item xs={12} sm={4}>
              <Card
                elevation={0}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                }}
              >
                <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Free
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>
                    1,000 sessions
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                    Perfect to get started
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary", "& li": { display: "flex", alignItems: "center", gap: 1, mb: 1, "& svg": { color: "success.main", flexShrink: 0 } } }}>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> Session Recording</li>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> 30-day retention</li>
                  </Box>
                  <Button
                    component={Link}
                    to="/signup"
                    variant="outlined"
                    fullWidth
                    sx={{ mt: "auto", py: 1.5 }}
                  >
                    Try Free
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            {/* Pro */}
            <Grid item xs={12} sm={4}>
              <Card
                elevation={0}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  border: "2px solid",
                  borderColor: "primary.main",
                  borderRadius: 2,
                  bgcolor: "rgba(190,149,250,0.06)",
                  position: "relative",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: "linear-gradient(90deg, #be95fa, #6366f1)",
                    borderRadius: "8px 8px 0 0",
                  }}
                />
                <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column", pt: 4 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Pro
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>
                    5,000 sessions
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                    For growing teams
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary", "& li": { display: "flex", alignItems: "center", gap: 1, mb: 1, "& svg": { color: "success.main", flexShrink: 0 } } }}>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> Everything in Free</li>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> DevTools (console &amp; network)</li>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> 90-day retention</li>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> Multiple projects</li>
                  </Box>
                  <Button
                    component={Link}
                    to="/signup"
                    variant="contained"
                    fullWidth
                    sx={{
                      mt: "auto",
                      py: 1.5,
                      background: primaryGradient,
                      color: "#fff",
                      "&:hover": { opacity: 0.95, background: primaryGradient },
                    }}
                  >
                    Start Now
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            {/* Enterprise */}
            <Grid item xs={12} sm={4}>
              <Card
                elevation={0}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                }}
              >
                <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Enterprise
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>
                    Unlimited
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                    Custom needs — let&apos;s talk
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary", "& li": { display: "flex", alignItems: "center", gap: 1, mb: 1, "& svg": { color: "success.main", flexShrink: 0 } } }}>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> Everything in Pro</li>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> Unlimited sessions</li>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> DevTools included</li>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> Custom retention</li>
                    <li><CheckIcon sx={{ fontSize: 18 }} /> Dedicated support</li>
                  </Box>
                  <Button
                    href="mailto:sales@quicklook.io"
                    variant="outlined"
                    fullWidth
                    sx={{ mt: "auto", py: 1.5 }}
                  >
                    Contact Sales
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          borderTop: "1px solid",
          borderColor: "divider",
          py: 3,
          mt: "auto",
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} Quicklook. Session replay &amp; DevTools for developers.
            </Typography>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button component={Link} to="/login" size="small" color="inherit" sx={{ color: "text.secondary" }}>
                Log in
              </Button>
              <Button component={Link} to="/signup" size="small" color="inherit" sx={{ color: "text.secondary" }}>
                Sign up
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
