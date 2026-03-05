import React from "react";
import { Link } from "react-router-dom";
import { Box, Typography, Button, Container } from "@mui/material";
import ArticleIcon from "@mui/icons-material/Article";
import { getPublicAssetUrl, getBasePath } from "../utils/baseUrl";
import { BLOG_ARTICLES } from "../data/blogArticles";

const primaryGradient = "linear-gradient(135deg, #be95fa 0%, #9370db 50%, #6366f1 100%)";

export default function BlogPage() {
  const base = getBasePath();

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
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1300,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "rgba(13,13,13,0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 2 }}>
            <Link to="/" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 10 }} aria-label="Quicklook home">
              <img src={getPublicAssetUrl("logo.png")} alt="Quicklook" width={32} height={32} style={{ display: "block" }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1.25rem" }}>
                Quicklook
              </Typography>
            </Link>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Button component={Link} to="/" color="inherit" sx={{ color: "text.secondary" }}>
                Home
              </Button>
              <Button component={Link} to="/#pricing" color="inherit" sx={{ color: "text.secondary" }}>
                Pricing
              </Button>
              <Button component="a" href={base === "/" ? "/login" : `${base}/login`} color="inherit" sx={{ color: "text.secondary" }}>
                Log in
              </Button>
              <Button component="a" href={base === "/" ? "/signup" : `${base}/signup`} variant="contained" sx={{ background: primaryGradient, color: "#fff", "&:hover": { opacity: 0.95, background: primaryGradient } }}>
                Try Free
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 }, flex: 1 }}>
        <Box sx={{ textAlign: "center", mb: 6 }}>
          <Typography component="h1" variant="h3" fontWeight={800} sx={{ mb: 1 }}>
            <Box component="span" sx={{ background: primaryGradient, backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Blog
            </Box>
          </Typography>
          <Typography variant="h6" color="text.secondary" fontWeight={400}>
            Session replay, UX analytics, and the best alternatives to Smartlook, Hotjar, and FullStory.
          </Typography>
        </Box>

        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {BLOG_ARTICLES.map((article) => (
            <Box
              component="li"
              key={article.slug}
              sx={{
                borderBottom: "1px solid",
                borderColor: "divider",
                py: 3,
                "&:first-of-type": { pt: 0 },
              }}
            >
              <Link
                to={`/blog/${article.slug}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
                aria-label={`Read: ${article.title} - ${article.subtitle}`}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                  <ArticleIcon sx={{ color: "primary.main", mt: 0.5, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5, "&:hover": { color: "primary.main" } }}>
                      {article.title}
                    </Typography>
                    <Typography variant="subtitle1" color="primary.main" fontWeight={600} sx={{ mb: 1 }}>
                      {article.subtitle}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {article.metaDescription}
                    </Typography>
                  </Box>
                </Box>
              </Link>
            </Box>
          ))}
        </Box>

        <Box sx={{ textAlign: "center", mt: 6 }}>
          <Button component={Link} to="/" variant="outlined" size="large">
            Back to Home
          </Button>
        </Box>
      </Container>

      <Box component="footer" sx={{ borderTop: "1px solid", borderColor: "divider", py: 3, mt: "auto" }}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" textAlign="center">
            © {new Date().getFullYear()} Quicklook. Session replay &amp; DevTools for developers.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
