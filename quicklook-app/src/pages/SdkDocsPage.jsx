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
      p: 2,
      borderRadius: 1,
      bgcolor: "action.hover",
      border: "1px solid",
      borderColor: "divider",
      fontFamily: "monospace",
      fontSize: "0.8125rem",
      overflow: "auto",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      ...sx,
    }}
  >
    {children}
  </Box>
);

const Section = ({ title, children }) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

export default function SdkDocsPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate(-1)} size="small" aria-label="Back">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <CodeIcon sx={{ fontSize: 28, color: "primary.main" }} />
        <Typography variant="h5" fontWeight={700}>
          QuickLook SDK — JavaScript integration
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          maxWidth: 720,
          mx: "auto",
          p: 4,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          This guide explains how to add the QuickLook session recording SDK to your website with JavaScript and view recordings in the QuickLook dashboard.
        </Typography>

        <Section title="1. Get your project key">
          <Typography variant="body2" paragraph>
            In the dashboard, create a project (or open an existing one) and go to{" "}
            <strong>Project → Settings → Integration</strong>. Your <strong>Project ID</strong> is the project key you will pass to the SDK. You can also copy the ready-made script from the Integration tab.
          </Typography>
          <Typography variant="body2">
            If you haven’t created a project yet: from the home page click <strong>New project</strong>, name it, then go to the Integration tab to get the snippet and your project key.
          </Typography>
        </Section>

        <Section title="2. Installation">
          <Typography variant="body2" paragraph>
            Add the SDK script to your HTML (e.g. in <code>&lt;head&gt;</code> or before <code>&lt;/body&gt;</code>). Load it with <code>async</code> so it doesn’t block the page.
          </Typography>
          <CodeBlock>{`<script src="https://your-quicklook-server.com/quicklook-sdk.js" async></script>
<!-- Optional: serve compress.worker.js from the same origin, or pass workerUrl in init -->`}</CodeBlock>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Replace <code>your-quicklook-server.com</code> with your QuickLook API base URL (e.g. <code>https://quicklook.io</code> for production or <code>http://localhost:3080</code> for local development).
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
            For <strong>local development</strong>, point <code>apiUrl</code> to your local server (e.g. <code>http://localhost:3080</code>). Recordings will still show in the same dashboard project when the server is configured to use the same backend.
          </Typography>
        </Section>

        <Section title="4. Init options (optional)">
          <Typography variant="body2" paragraph>
            You can pass a third argument to <code>init</code> with options:
          </Typography>
          <CodeBlock>{`window.quicklook("init", "YOUR_PROJECT_KEY", {
  apiUrl: "https://quicklook.io",
  retentionDays: 30,
  captureStorage: false,
  workerUrl: "/path/to/compress.worker.js",  // or false to disable compression
  excludedUrls: ["/privacy", "/admin"],       // do not record on these URL substrings
  includedUrls: ["/checkout", "/pricing"],   // only record on these (if set, others are ignored)
  inactivityTimeout: 300000,                  // 5 min (ms); 0 = disable
  pauseOnHidden: true,                       // pause when tab is hidden
  maxSessionDuration: 3600000,               // 60 min (ms); 0 = no limit
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

        <Section title="6. Commands reference">
          <List dense disablePadding>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={<><code>init(projectKey, options?)</code> — Start recording (required first).</>}
                primaryTypographyProps={{ variant: "body2" }}
              />
            </ListItem>
            <ListItem sx={{ py: 0.25 }}>
              <ListItemText
                primary={<><code>identify({ firstName?, lastName?, email?, ...custom })</code> — Set user identity.</>}
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

        <Section title="7. View sessions in the dashboard">
          <Typography variant="body2" paragraph>
            Once the SDK is sending data for your project key:
          </Typography>
          <List dense disablePadding sx={{ listStyleType: "disc", pl: 2 }}>
            <ListItem sx={{ py: 0.25, display: "list-item" }}>
              <ListItemText primary="Open the dashboard and select your project." primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
            <ListItem sx={{ py: 0.25, display: "list-item" }}>
              <ListItemText primary="Go to Sessions to see the list of recordings (filter by date, status, etc.)." primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
            <ListItem sx={{ py: 0.25, display: "list-item" }}>
              <ListItemText primary="Click a session to watch the replay (playback of DOM, clicks, scrolls, and navigation)." primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
            <ListItem sx={{ py: 0.25, display: "list-item" }}>
              <ListItemText primary="If you called identify(), the user info and related sessions by the same user or device appear in the replay panel." primaryTypographyProps={{ variant: "body2" }} />
            </ListItem>
          </List>
        </Section>

        <Section title="8. Local development">
          <Typography variant="body2" paragraph>
            Run your QuickLook server locally (e.g. on port 3080) and use:
          </Typography>
          <CodeBlock>{`window.quicklook("init", "YOUR_PROJECT_KEY", {
  apiUrl: "http://localhost:3080"
});`}</CodeBlock>
          <Typography variant="body2">
            Ensure <code>quicklook-sdk.js</code> and <code>compress.worker.js</code> are served by your server (or set <code>workerUrl</code>). Sessions will appear in the same dashboard when the app is pointed at that server.
          </Typography>
        </Section>

        <Section title="9. Full page example">
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

        <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="body2" color="text.secondary">
            For more details (SPA routing, inactivity, session limits), see the <code>quicklook-sdk/README.md</code> in the project repo. To get your project key and copy the integration snippet, go to{" "}
            <Link component="button" variant="body2" onClick={() => navigate("/")} sx={{ verticalAlign: "baseline" }}>
              Dashboard → Project → Settings → Integration
            </Link>.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
