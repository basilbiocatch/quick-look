import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  CardContent,
  CircularProgress,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import BugReportIcon from "@mui/icons-material/BugReport";
import InsightsIcon from "@mui/icons-material/Insights";
import CheckIcon from "@mui/icons-material/Check";
import { getPublicAssetUrl, getBasePath } from "../utils/baseUrl";
import { getPlansConfig } from "../api/subscriptionApi";
import { BLOG_ARTICLES } from "../data/blogArticles";

const sectionSx = {
  py: { xs: 6, md: 10 },
};

const primaryGradient = "linear-gradient(135deg, #be95fa 0%, #9370db 50%, #6366f1 100%)";

export default function MarketingHomePage() {
  const base = getBasePath();
  const loginHref = base === "/" ? "/login" : `${base}/login`;
  const signupHref = base === "/" ? "/signup" : `${base}/signup`;

  const [plans, setPlans] = useState(null);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPlansConfig()
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.plans ?? res.data?.data ?? res.data;
        setPlans(Array.isArray(data) ? data : null);
      })
      .catch(() => {
        if (!cancelled) setPlans(null);
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
      {/* Header / Nav - high z-index and pointer-events so nothing covers the buttons */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1300,
          pointerEvents: "auto",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(13,13,13,0.95)",
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
            pointerEvents: "none",
          },
          "&:hover::after": {
            opacity: 0.6,
          },
        }}
      >
        <Container maxWidth="lg" sx={{ pointerEvents: "auto" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 2,
              pointerEvents: "auto",
            }}
          >
            <Link to="/" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 10 }} aria-label="Quicklook home">
              <img src={getPublicAssetUrl("logo.png")} alt="Quicklook - Session replay and DevTools for developers" width={32} height={32} style={{ display: "block" }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.25rem" }}>
                Quicklook
              </Typography>
            </Link>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, pointerEvents: "auto" }}>
              <Button
                component={Link}
                to="/blog"
                color="inherit"
                sx={{
                  color: "text.secondary",
                  transition: "color 0.2s ease, transform 0.2s ease",
                  "&:hover": { color: "text.primary", transform: "translateY(-1px)" },
                }}
              >
                Blog
              </Button>
              <Button
                component="a"
                href="#pricing"
                color="inherit"
                sx={{
                  color: "text.secondary",
                  transition: "color 0.2s ease, transform 0.2s ease",
                  "&:hover": { color: "text.primary", transform: "translateY(-1px)" },
                }}
              >
                Pricing
              </Button>
              <Button
                component="a"
                href={loginHref}
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
                component="a"
                href={signupHref}
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
              <Box component="span" sx={{ background: primaryGradient, backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                AI that explains why users abandon your product
              </Box>
              {" "}
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
              {" "}through recordings
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 4, fontWeight: 400, fontSize: { xs: "1rem", md: "1.25rem" } }} component="p">
              Session replays plus AI—see what users did and get clear reasons they left. Fix drop-off and improve UX with no guesswork.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
              <Button
                component={Link}
                to="/signup"
                variant="contained"
                size="large"
                aria-label="Try Quicklook free"
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
              <Button component={Link} to="/login" variant="outlined" size="large" sx={{ px: 3, py: 1.5 }} aria-label="Log in to Quicklook">
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
            <Grid item xs={12} md={4}>
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
            <Grid item xs={12} md={4}>
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
            <Grid item xs={12} md={4}>
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
                  <InsightsIcon sx={{ fontSize: 56, color: "primary.main" }} />
                </Box>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    AI Insights
                  </Typography>
                  <Typography color="text.secondary">
                    Friction detection, conversion impact, and suggested fixes with predicted lift. Get AI session summaries, root cause analysis, and A/B test ideas so you can understand and fix issues at scale.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Blog / SEO resources */}
      <Box component="section" sx={{ ...sectionSx, bgcolor: "rgba(255,255,255,0.02)" }} aria-labelledby="blog-heading">
        <Container maxWidth="lg">
          <Typography id="blog-heading" component="h2" variant="h4" fontWeight={700} textAlign="center" sx={{ mb: 2 }}>
            From the blog
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4, maxWidth: 560, mx: "auto" }}>
            Compare QuickLook to Smartlook, Hotjar, and FullStory—and see why teams choose session replay with DevTools and AI.
          </Typography>
          <Grid container spacing={2} justifyContent="center">
            {BLOG_ARTICLES.map((article) => (
              <Grid item xs={12} sm={6} md={4} key={article.slug}>
                <Button
                  component={Link}
                  to={`/blog/${article.slug}`}
                  fullWidth
                  sx={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    py: 2,
                    px: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    color: "text.primary",
                    "&:hover": {
                      borderColor: "primary.main",
                      bgcolor: "rgba(190,149,250,0.08)",
                    },
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} display="block">
                      {article.title}
                    </Typography>
                    <Typography variant="body2" color="primary.main" fontWeight={600}>
                      {article.subtitle}
                    </Typography>
                  </Box>
                </Button>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ textAlign: "center", mt: 3 }}>
            <Button component={Link} to="/blog" variant="outlined" size="large">
              View all articles
            </Button>
          </Box>
        </Container>
      </Box>

      {/* FAQ - Session replay and Quicklook for developers */}
      <Box
        component="section"
        sx={{ ...sectionSx, bgcolor: "rgba(255,255,255,0.02)" }}
        aria-labelledby="faq-heading"
        itemScope
        itemType="https://schema.org/FAQPage"
      >
        <Container maxWidth="md">
          <Typography id="faq-heading" component="h2" variant="h4" fontWeight={700} textAlign="center" sx={{ mb: 6 }}>
            Frequently Asked Questions
          </Typography>
          <Box component="dl" sx={{ m: 0 }}>
            <Box component="div" itemProp="mainEntity" itemScope itemType="https://schema.org/Question" sx={{ mb: 4 }}>
              <Typography component="dt" variant="h6" fontWeight={600} sx={{ mb: 1 }} itemProp="name">What is session replay?</Typography>
              <Typography component="dd" color="text.secondary" sx={{ m: 0, pl: 0 }} itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <span itemProp="text">Session replay is a developer tool that records how users interact with your web app—clicks, scrolls, navigation, and inputs—so you can replay the session exactly as it happened. It helps you reproduce bugs and understand user behavior.</span>
              </Typography>
            </Box>
            <Box component="div" itemProp="mainEntity" itemScope itemType="https://schema.org/Question" sx={{ mb: 4 }}>
              <Typography component="dt" variant="h6" fontWeight={600} sx={{ mb: 1 }} itemProp="name">How does Quicklook help developers debug?</Typography>
              <Typography component="dd" color="text.secondary" sx={{ m: 0, pl: 0 }} itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <span itemProp="text">Quicklook combines session replay with integrated DevTools: you see the user&apos;s recording alongside console logs, network requests, and user context in one place. No more guessing what the user did—replay the session and debug with full context.</span>
              </Typography>
            </Box>
            <Box component="div" itemProp="mainEntity" itemScope itemType="https://schema.org/Question" sx={{ mb: 4 }}>
              <Typography component="dt" variant="h6" fontWeight={600} sx={{ mb: 1 }} itemProp="name">Is there a free tier?</Typography>
              <Typography component="dd" color="text.secondary" sx={{ m: 0, pl: 0 }} itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <span itemProp="text">Yes. Quicklook offers a free tier with 1,000 sessions per month and 30-day retention. You get session recording to get started; Pro adds DevTools, 90-day retention, multiple projects, AI Insights (conversion impact, friction patterns), session summaries, and suggested fixes with predicted lift for A/B tests.</span>
              </Typography>
            </Box>
            <Box component="div" itemProp="mainEntity" itemScope itemType="https://schema.org/Question" sx={{ mb: 4 }}>
              <Typography component="dt" variant="h6" fontWeight={600} sx={{ mb: 1 }} itemProp="name">How do I add session replay to my app?</Typography>
              <Typography component="dd" color="text.secondary" sx={{ m: 0, pl: 0 }} itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <span itemProp="text">Add the Quicklook script to your site, create a project in the dashboard, and start recording. The SDK captures DOM events and sends them to Quicklook so you can replay sessions in the dashboard.</span>
              </Typography>
            </Box>
            <Box component="div" itemProp="mainEntity" itemScope itemType="https://schema.org/Question" sx={{ mb: 0 }}>
              <Typography component="dt" variant="h6" fontWeight={600} sx={{ mb: 1 }} itemProp="name">What is included in Quicklook DevTools?</Typography>
              <Typography component="dd" color="text.secondary" sx={{ m: 0, pl: 0 }} itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <span itemProp="text">DevTools in Quicklook include console logs, network requests, and user context (device, URL, etc.) synchronized with the session replay. Everything appears in one view so you can debug faster.</span>
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Pricing — from GET /api/config/plans (config + experiments when logged in) */}
      <Box component="section" sx={sectionSx} id="pricing">
        <Container maxWidth="lg">
          <Typography component="h2" variant="h4" fontWeight={700} textAlign="center" sx={{ mb: 6 }}>
            Simple, transparent pricing
          </Typography>
          {plansLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : plans?.length > 0 ? (
            <Grid container spacing={3} justifyContent="center" alignItems="stretch">
              {plans.map((plan, index) => {
                const isPro = plan.tier === "pro";
                const isEnterprise = plan.tier === "enterprise" || plan.tier === "premium";
                const highlight = isPro || plan.ui?.badgeText;
                const priceDisplay = plan.pricing?.annual?.displayPrice ?? plan.pricing?.monthly?.displayPrice ?? null;
                const sessionLabel = plan.limits?.sessionCap != null
                  ? `${plan.limits.sessionCap.toLocaleString()} sessions`
                  : plan.limits?.sessionCap == null && isEnterprise
                    ? "Unlimited"
                    : null;
                const featureList = plan.ui?.featureList ?? [];
                return (
                  <Grid item xs={12} sm={4} key={`${plan.tier}-${index}`}>
                    <Card
                      elevation={0}
                      sx={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        border: highlight ? "2px solid" : "1px solid",
                        borderColor: highlight ? "primary.main" : "divider",
                        borderRadius: 2,
                        bgcolor: highlight ? "rgba(190,149,250,0.06)" : "background.paper",
                        position: "relative",
                      }}
                    >
                      {highlight && (
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
                      )}
                      <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column", pt: highlight ? 4 : 3 }}>
                        {plan.ui?.badgeText && (
                          <Typography variant="caption" fontWeight={600} color="primary" sx={{ mb: 0.5 }}>
                            {plan.ui.badgeText}
                          </Typography>
                        )}
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                          {plan.displayName || plan.tier}
                        </Typography>
                        <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>
                          {priceDisplay || sessionLabel || plan.displayName}
                        </Typography>
                        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                          {plan.tagline || plan.ui?.description || ""}
                        </Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary", "& li": { display: "flex", alignItems: "center", gap: 1, mb: 1, "& svg": { color: "success.main", flexShrink: 0 } } }}>
                          {featureList.map((item, i) => (
                            <li key={i}><CheckIcon sx={{ fontSize: 18 }} /> {item}</li>
                          ))}
                        </Box>
                        {isEnterprise ? (
                          <Button
                            href="mailto:sales@quicklook.io"
                            variant="outlined"
                            fullWidth
                            sx={{ mt: "auto", py: 1.5 }}
                          >
                            Contact Sales
                          </Button>
                        ) : (
                          <Button
                            component={Link}
                            to={isPro ? "/signup?plan=pro" : "/signup"}
                            variant={isPro ? "contained" : "outlined"}
                            fullWidth
                            sx={{
                              mt: "auto",
                              py: 1.5,
                              ...(isPro && { background: primaryGradient, color: "#fff", "&:hover": { opacity: 0.95, background: primaryGradient } }),
                            }}
                          >
                            {isPro ? "Start Now" : "Try Free"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Grid container spacing={3} justifyContent="center" alignItems="stretch">
              <Grid item xs={12} sm={4}>
                <Card elevation={0} sx={{ height: "100%", display: "flex", flexDirection: "column", border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
                  <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>Free</Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>1,000 sessions</Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>Perfect to get started</Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary", "& li": { display: "flex", alignItems: "center", gap: 1, mb: 1, "& svg": { color: "success.main", flexShrink: 0 } } }}>
                      <li><CheckIcon sx={{ fontSize: 18 }} /> Session Recording</li>
                      <li><CheckIcon sx={{ fontSize: 18 }} /> 30-day retention</li>
                    </Box>
                    <Button component={Link} to="/signup" variant="outlined" fullWidth sx={{ mt: "auto", py: 1.5 }}>Try Free</Button>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card elevation={0} sx={{ height: "100%", display: "flex", flexDirection: "column", border: "2px solid", borderColor: "primary.main", borderRadius: 2, bgcolor: "rgba(190,149,250,0.06)", position: "relative" }}>
                  <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #be95fa, #6366f1)", borderRadius: "8px 8px 0 0" }} />
                  <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column", pt: 4 }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>Pro</Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>5,000 sessions</Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>For growing teams</Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary", "& li": { display: "flex", alignItems: "center", gap: 1, mb: 1, "& svg": { color: "success.main", flexShrink: 0 } } }}>
                      <li><CheckIcon sx={{ fontSize: 18 }} /> Everything in Free</li>
                      <li><CheckIcon sx={{ fontSize: 18 }} /> DevTools</li>
                      <li><CheckIcon sx={{ fontSize: 18 }} /> 90-day retention</li>
                      <li><CheckIcon sx={{ fontSize: 18 }} /> Multiple projects</li>
                      <li><CheckIcon sx={{ fontSize: 18 }} /> AI Insights</li>
                    </Box>
                    <Button component={Link} to="/signup?plan=pro" variant="contained" fullWidth sx={{ mt: "auto", py: 1.5, background: primaryGradient, color: "#fff", "&:hover": { opacity: 0.95, background: primaryGradient } }}>Start Now</Button>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card elevation={0} sx={{ height: "100%", display: "flex", flexDirection: "column", border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
                  <CardContent sx={{ p: 3, flex: 1, display: "flex", flexDirection: "column" }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>Enterprise</Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>Unlimited</Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>Custom needs — let&apos;s talk</Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5, color: "text.secondary", "& li": { display: "flex", alignItems: "center", gap: 1, mb: 1, "& svg": { color: "success.main", flexShrink: 0 } } }}>
                      <li><CheckIcon sx={{ fontSize: 18 }} /> Everything in Pro</li>
                      <li><CheckIcon sx={{ fontSize: 18 }} /> Unlimited sessions</li>
                      <li><CheckIcon sx={{ fontSize: 18 }} /> Dedicated support</li>
                    </Box>
                    <Button href="mailto:sales@quicklook.io" variant="outlined" fullWidth sx={{ mt: "auto", py: 1.5 }}>Contact Sales</Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
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
              <Button component={Link} to="/blog" size="small" color="inherit" sx={{ color: "text.secondary" }}>
                Blog
              </Button>
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
