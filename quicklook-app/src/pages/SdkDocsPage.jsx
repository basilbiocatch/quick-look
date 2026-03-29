import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CodeIcon from "@mui/icons-material/Code";

const CodeBlock = ({ children, ...sx }) => (
  <Box
    component="pre"
    sx={{
      p: 2.5,
      borderRadius: 2,
      bgcolor: "rgba(0,0,0,0.35)",
      border: "1px solid",
      borderColor: "rgba(138, 43, 226, 0.15)",
      fontFamily: "ui-monospace, 'SF Mono', Monaco, 'Cascadia Mono', monospace",
      fontSize: "0.875rem",
      lineHeight: 1.6,
      overflow: "auto",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      color: "rgba(255,255,255,0.92)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      ...sx,
    }}
  >
    {children}
  </Box>
);

const Section = ({ title, children }) => (
  <Box sx={{ mb: 5 }}>
    <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: "rgba(255,255,255,0.95)" }}>
      {title}
    </Typography>
    {children}
  </Box>
);

export default function SdkDocsPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(165deg, #0d0b12 0%, #15121a 35%, #1a1625 70%, #0f0d14 100%)",
        p: { xs: 3, sm: 4, md: 5 },
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(100%, 1100px)",
          height: 320,
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(138, 43, 226, 0.12) 0%, transparent 60%)",
          pointerEvents: "none",
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          maxWidth: 1024,
          mx: "auto",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
          <IconButton
            onClick={() => navigate(-1)}
            size="small"
            aria-label="Back"
            sx={{
              color: "rgba(255,255,255,0.7)",
              "&:hover": { color: "rgba(200, 162, 255, 0.9)", bgcolor: "rgba(138, 43, 226, 0.12)" },
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, rgba(138, 43, 226, 0.25) 0%, rgba(75, 0, 130, 0.2) 100%)",
              border: "1px solid rgba(138, 43, 226, 0.3)",
              boxShadow: "0 0 24px rgba(138, 43, 226, 0.15)",
            }}
          >
            <CodeIcon sx={{ fontSize: 24, color: "rgba(200, 162, 255, 0.95)" }} />
          </Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: "rgba(255,255,255,0.98)", letterSpacing: "-0.02em" }}>
            QuickLook SDK — JavaScript integration
          </Typography>
        </Box>

      <Paper
        elevation={0}
        sx={{
          maxWidth: 1024,
          mx: "auto",
          p: { xs: 3, sm: 4, md: 5 },
          border: "1px solid",
          borderColor: "rgba(138, 43, 226, 0.18)",
          borderRadius: 3,
          bgcolor: "rgba(22, 20, 30, 0.6)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.03) inset",
        }}
      >
        <Box sx={{ "& .MuiTypography-root": { color: "rgba(255,255,255,0.82)" }, "& code": { color: "rgba(200, 162, 255, 0.9)", bgcolor: "rgba(138, 43, 226, 0.12)", px: 0.5, py: 0.25, borderRadius: 1, fontSize: "0.9em" } }}>
        <Typography variant="body1" sx={{ mb: 4, color: "rgba(255,255,255,0.78)", lineHeight: 1.7 }}>
          This guide explains how to add the QuickLook session recording SDK to your website with JavaScript and view recordings in the QuickLook dashboard.
        </Typography>

        <Section title="1. Get your project key">
          <Typography variant="body2" paragraph sx={{ lineHeight: 1.7 }}>
            In the dashboard, create a project (or open an existing one) and go to{" "}
            <strong>Project → Settings → Integration</strong>. Your <strong>Project ID</strong> is the project key you will pass to the SDK. You can also copy the ready-made script from the Integration tab.
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
            If you haven’t created a project yet: from the home page click <strong>New project</strong>, name it, then go to the Integration tab to get the snippet and your project key.
          </Typography>
        </Section>

        <Section title="2. Installation">
          <Typography variant="body2" paragraph>
            Add the SDK script to your HTML (e.g. in <code>&lt;head&gt;</code> or before <code>&lt;/body&gt;</code>). Load it with <code>async</code> so it doesn’t block the page.
          </Typography>
          <CodeBlock>{`<script src="https://quick.ook.io/quicklook-sdk.js" async></script>
<!-- Optional: serve compress.worker.js from the same origin, or pass workerUrl in init -->`}</CodeBlock>
          <Typography variant="body2" sx={{ mt: 1 }}>
          </Typography>
        </Section>

        <Section title="3. Initialize and connect to the dashboard">
          <Typography variant="body2" paragraph>
            Call <code>quicklook('init', projectKey, options)</code> after the script loads. Use the <strong>project key</strong> from the dashboard (Project Settings → Integration). Sessions will appear under that project in the dashboard.
          </Typography>
          <CodeBlock>{`<script src="https://quicklook.io/quicklook-sdk.js" async></script>
<script>
  // Use the project key from Dashboard → Project → Settings → Integration
  window.quicklook("init", "YOUR_PROJECT_KEY", {
    apiUrl: "https://quicklook.io"
  });
</script>`}</CodeBlock>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Sessions will appear under that project in the dashboard.
          </Typography>
        </Section>

        <Section title="4. Init options (optional)">
          <Typography variant="body2" paragraph>
            You can pass a third argument to <code>init</code> with options:
          </Typography>
          <CodeBlock>{`window.quicklook("init", "YOUR_PROJECT_KEY", {
  apiUrl: "https://quicklook.io",
  workerUrl: "/path/to/compress.worker.js",  // or false to disable compression
  excludedUrls: ["/privacy", "/admin"],       // do not record on these URL substrings
  includedUrls: ["/checkout", "/pricing"],   // only record on these (if set, others are ignored)
  region: "eu"                                // custom keys are stored on the session
});`}</CodeBlock>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>excludedUrls</strong>: If the current URL contains any of these strings, recording is skipped. You can also configure exclusions in the dashboard (Project Settings → Page exclusions).<br />
            <strong>includedUrls</strong>: If set, recording runs only when the URL contains at least one of these strings. Useful for monitoring specific flows (e.g. checkout only).
          </Typography>
        </Section>

        <Section title="5. Identify users (optional)">
          <Typography variant="body2" paragraph>
            To see who a session belongs to in the dashboard, call <code>identify</code> with user data. This appears in the session metadata and in “Related sessions” when you open a replay.
          </Typography>
          <CodeBlock>{`window.quicklook("identify", {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com"
  // any other custom properties
});`}</CodeBlock>
        </Section>

        <Section title="6. Product events (track)">
          <Typography variant="body2" paragraph sx={{ lineHeight: 1.7 }}>
            Use <code>track</code> to record named analytics events (feature usage, milestones). This is separate from the DOM replay: it only sends lightweight event names and optional properties. In the dashboard, open your project and use the sidebar <strong>Events</strong> page to filter by time range, event name prefix, and sort by volume or name. Each replay also lists product events in the right panel under <strong>Product events</strong>.
          </Typography>
          <Typography variant="body2" paragraph sx={{ lineHeight: 1.7 }}>
            <strong>Naming:</strong> stable lowercase names with underscores, e.g. <code>checkout_started</code>, <code>export_clicked</code>. <strong>Properties:</strong> optional plain object for dimensions (no secrets or raw PII). Server limits apply (name length, JSON size, key count).
          </Typography>
          <CodeBlock>{`window.quicklook("track", "feature_used", { featureId: "saved_views" });
window.quicklook("track", "checkout_started");`}</CodeBlock>
        </Section>

        <Section title="7. Commands reference">
          <List dense disablePadding>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={<><code>init(projectKey, options?)</code> — Start recording (required first).</>}
                primaryTypographyProps={{ variant: "body2" }}
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={<><code>{"identify({ firstName?, lastName?, email?, ...custom })"}</code> — Set user identity.</>}
                primaryTypographyProps={{ variant: "body2" }}
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={<><code>{"track(name, properties?)"}</code> — Product analytics event for the current session.</>}
                primaryTypographyProps={{ variant: "body2" }}
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={<><code>getIdentity()</code> — Return current identity (debugging).</>}
                primaryTypographyProps={{ variant: "body2" }}
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={<><code>stop()</code> — Stop recording and flush data.</>}
                primaryTypographyProps={{ variant: "body2" }}
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={<><code>getSessionId(callback?)</code> — Current session ID (sync or via callback).</>}
                primaryTypographyProps={{ variant: "body2" }}
              />
            </ListItem>
          </List>
          <Typography variant="body2" sx={{ mt: 1 }}>
            You can also read <code>window.quicklook.sessionId</code> (may be <code>null</code> before the session has started).
          </Typography>
        </Section>

        <Section title="8. View sessions in the dashboard">
          <Typography variant="body2" paragraph>
            Once the SDK is sending data for your project key:
          </Typography>
          <List dense disablePadding sx={{ listStyleType: "disc", pl: 2 }}>
            <ListItem sx={{ py: 0.25, display: "list-item" }}>
              <ListItemText primary="Open the dashboard and select your project." primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
            <ListItem sx={{ py: 0.25, display: "list-item" }}>
              <ListItemText primary="Go to Sessions to see the list of recordings (filter by date, status, etc.). Open Events to see aggregated product events from track()." primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
            <ListItem sx={{ py: 0.25, display: "list-item" }}>
              <ListItemText primary="Click a session to watch the replay (playback of DOM, clicks, scrolls, and navigation)." primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
            <ListItem sx={{ py: 0.25, display: "list-item" }}>
              <ListItemText primary="If you called identify(), the user info and related sessions by the same user or device appear in the replay panel." primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
          </List>
        </Section>

        <Section title="9. Self‑hosted / local development (optional)">
          <Typography variant="body2" paragraph>
            Only if you run your own QuickLook server (e.g. on-prem or local dev): set <code>apiUrl</code> to that server’s URL. For production websites, use the default QuickLook API (<code>https://quicklook.io</code>) and do not set <code>apiUrl</code> to localhost.
          </Typography>
          <Typography variant="body2">
            Ensure <code>quicklook-sdk.js</code> and <code>compress.worker.js</code> are served by your server (or set <code>workerUrl</code>). Sessions will appear in the dashboard when the app is pointed at that server.
          </Typography>
        </Section>

        <Section title="10. Full page example">
          <CodeBlock>{`<!DOCTYPE html>
<html>
<head>
  <title>My app</title>
</head>
<body>
  <h1>My app</h1>

  <script src="https://quicklook.io/quicklook-sdk.js" async></script>
  <script>
    window.quicklook("init", "YOUR_PROJECT_KEY", { apiUrl: "https://quicklook.io" });
    // Optional: after login
    // window.quicklook("identify", { email: "user@example.com", firstName: "Jane" });
  </script>
</body>
</html>`}</CodeBlock>
        </Section>

      
        </Box>
      </Paper>
      </Box>
    </Box>
  );
}
