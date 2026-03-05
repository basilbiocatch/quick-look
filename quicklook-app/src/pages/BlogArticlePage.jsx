import React, { useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Box, Typography, Button, Container } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getPublicAssetUrl, getBasePath } from "../utils/baseUrl";
import { getArticleBySlug, BLOG_ARTICLES } from "../data/blogArticles";

const primaryGradient = "linear-gradient(135deg, #be95fa 0%, #9370db 50%, #6366f1 100%)";

function setPageMeta(title, description) {
  document.title = title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && description) metaDesc.setAttribute("content", description);
}

export default function BlogArticlePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const base = getBasePath();
  const article = slug ? getArticleBySlug(slug) : null;

  useEffect(() => {
    if (article) {
      setPageMeta(article.metaTitle, article.metaDescription);
      return () => setPageMeta("Quicklook – Session replay & DevTools for developers", "Session replay and DevTools built for developers. Record user sessions, debug with integrated DevTools, and ship faster.");
    }
  }, [article]);

  if (!article) {
    navigate("/blog", { replace: true });
    return null;
  }

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
              <Button component={Link} to="/blog" color="inherit" startIcon={<ArrowBackIcon />} sx={{ color: "text.secondary" }}>
                Blog
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

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 }, flex: 1 }}>
        <Button component={Link} to="/blog" startIcon={<ArrowBackIcon />} sx={{ mb: 3, color: "text.secondary" }}>
          All articles
        </Button>

        <article itemScope itemType="https://schema.org/Article">
          <Typography component="h1" variant="h3" fontWeight={800} sx={{ mb: 1 }} itemProp="headline">
            {article.title}
          </Typography>
          <Typography variant="h5" color="primary.main" fontWeight={600} sx={{ mb: 3 }} itemProp="description">
            {article.subtitle}
          </Typography>

          <Box sx={{ "& h2": { mt: 3, mb: 1.5, fontSize: "1.5rem" }, "& p": { mb: 2, lineHeight: 1.7 } }}>
            {article.content.map((block, i) =>
              block.type === "h2" ? (
                <Typography key={i} component="h2" variant="h5" fontWeight={700} id={block.text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}>
                  {block.text}
                </Typography>
              ) : (
                <Typography key={i} component="p" variant="body1" color="text.secondary" itemProp={i === 0 ? "articleBody" : undefined}>
                  {block.text}
                </Typography>
              )
            )}
          </Box>
        </article>

        <Box sx={{ mt: 5, p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "rgba(255,255,255,0.02)" }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
            Try QuickLook free
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Session replay, DevTools, and AI insights in one tool. 1,000 sessions per month—no credit card required.
          </Typography>
          <Button component={Link} to="/signup" variant="contained" sx={{ background: primaryGradient, color: "#fff", "&:hover": { opacity: 0.95, background: primaryGradient } }}>
            Get started
          </Button>
        </Box>

        {BLOG_ARTICLES.filter((a) => a.slug !== article.slug).length > 0 && (
          <Box sx={{ mt: 6 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              More from the blog
            </Typography>
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
              {BLOG_ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 4).map((a) => (
                <Box component="li" key={a.slug} sx={{ mb: 1 }}>
                  <Link to={`/blog/${a.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                    <Typography sx={{ "&:hover": { color: "primary.main" } }}>{a.title} — {a.subtitle}</Typography>
                  </Link>
                </Box>
              ))}
            </Box>
          </Box>
        )}

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
