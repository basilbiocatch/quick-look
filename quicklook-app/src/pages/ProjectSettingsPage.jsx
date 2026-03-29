import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  IconButton,
  Paper,
  TextField,
  Button,
  Link,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BlockIcon from "@mui/icons-material/Block";
import PublicIcon from "@mui/icons-material/Public";
import ScheduleIcon from "@mui/icons-material/Schedule";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import SettingsIcon from "@mui/icons-material/Settings";
import CodeIcon from "@mui/icons-material/Code";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GroupIcon from "@mui/icons-material/Group";
import { useAuth } from "../contexts/AuthContext";
import { useProjects } from "../contexts/ProjectsContext";
import {
  getProject,
  updateProject,
  deleteProject,
  inviteProjectMember,
  getProjectMembers,
  updateProjectMemberRole,
  removeProjectMember,
  revokeProjectInvitation,
} from "../api/quicklookApi";

function getApiBase() {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base) return base.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://your-api.example.com";
}

export default function ProjectSettingsPage() {
  const { projectKey } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch: refetchProjects } = useProjects();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [allowedDomains, setAllowedDomains] = useState([]);
  const [newDomain, setNewDomain] = useState("");
  const [excludedUrls, setExcludedUrls] = useState([]);
  const [newPattern, setNewPattern] = useState("");
  const [tabIndex, setTabIndex] = useState(0);
  const [integrationMode, setIntegrationMode] = useState("developer");
  const [copied, setCopied] = useState(false);
  const [deviceIdEnabled, setDeviceIdEnabled] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [team, setTeam] = useState(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteBusy, setInviteBusy] = useState(false);

  const isOwner = project?.role === "owner";
  const isPro = user?.plan === "pro";
  const canEditSettings = isOwner;

  useEffect(() => {
    if (!isOwner && tabIndex === 3) setTabIndex(0);
  }, [isOwner, tabIndex]);

  useEffect(() => {
    if (tabIndex !== 3 || !isOwner || !isPro || !projectKey) return;
    let cancelled = false;
    setTeamLoading(true);
    setTeamError("");
    getProjectMembers(projectKey)
      .then((res) => {
        if (!cancelled && res.data?.data) setTeam(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) setTeamError(err.response?.data?.error || err.message || "Failed to load team");
      })
      .finally(() => {
        if (!cancelled) setTeamLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tabIndex, isOwner, isPro, projectKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getProject(projectKey)
      .then((res) => {
        if (!cancelled && res.data?.data) {
          const p = res.data.data;
          setProject(p);
          setName(p.name || "");
          setAllowedDomains(Array.isArray(p.allowedDomains) ? [...p.allowedDomains] : []);
          setExcludedUrls(p.excludedUrls || []);
          setDeviceIdEnabled(Boolean(p.deviceIdEnabled));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || err.message || "Failed to load project");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectKey]);

  const handleAddExcluded = () => {
    const v = newPattern.trim();
    if (!v || excludedUrls.includes(v)) return;
    setExcludedUrls((prev) => [...prev, v]);
    setNewPattern("");
  };

  const handleRemoveExcluded = (index) => {
    setExcludedUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddDomain = () => {
    const v = newDomain.trim();
    if (!v || allowedDomains.includes(v)) return;
    setAllowedDomains((prev) => [...prev, v]);
    setNewDomain("");
  };

  const handleRemoveDomain = (index) => {
    setAllowedDomains((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!canEditSettings) return;
    setSaving(true);
    setError("");
    const payload = {
      name: name.trim() || project?.name,
      allowedDomains,
      excludedUrls,
      deviceIdEnabled,
    };
    updateProject(projectKey, payload)
      .then((res) => {
        if (res.data?.data) {
          const p = res.data.data;
          setProject(p);
          setName(p.name || "");
          setAllowedDomains(Array.isArray(p.allowedDomains) ? [...p.allowedDomains] : []);
          setExcludedUrls(p.excludedUrls || []);
          setDeviceIdEnabled(Boolean(p.deviceIdEnabled));
        }
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to save");
      })
      .finally(() => setSaving(false));
  };

  const savedDomains = project?.allowedDomains || [];
  const domainsChanged =
    allowedDomains.length !== savedDomains.length ||
    allowedDomains.some((d, i) => {
      return savedDomains[i] !== d;
    });
  const projectExcluded = project?.excludedUrls || [];
  const excludedUrlsChanged =
    excludedUrls.length !== projectExcluded.length ||
    excludedUrls.some((u, i) => {
      return projectExcluded[i] !== u;
    });
  const deviceIdEnabledChanged = project ? deviceIdEnabled !== Boolean(project.deviceIdEnabled) : false;
  const nameChanged = project ? name.trim() !== (project.name || "") : false;
  const hasChanges = project && (nameChanged || domainsChanged || excludedUrlsChanged || deviceIdEnabledChanged);

  const apiBase = getApiBase();
  const integrationSnippet = project
    ? `<script src="${apiBase}/quicklook-sdk.js" async></script>
<script>
  quicklook('init', '${projectKey}', { apiUrl: '${apiBase}' });
  // Optional: quicklook('identify', { email: 'user@example.com', firstName: 'Jane' });
</script>`
    : "";
  const integrationPrompt = project
    ? `Add this session recording script to my site in a non-blocking way. Place it at the end of the body. Use the async attribute on the script that loads the SDK so it does not block page load. Here is the exact code to add:

${integrationSnippet}`
    : "";

  const copySnippet = () => {
    const text = integrationMode === "developer" ? integrationSnippet : integrationPrompt;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const reloadTeam = () => {
    if (!projectKey || !isOwner || !isPro) return;
    setTeamLoading(true);
    setTeamError("");
    getProjectMembers(projectKey)
      .then((res) => {
        if (res.data?.data) setTeam(res.data.data);
      })
      .catch((err) => {
        setTeamError(err.response?.data?.error || err.message || "Failed to load team");
      })
      .finally(() => setTeamLoading(false));
  };

  const handleSendInvite = () => {
    const em = inviteEmail.trim().toLowerCase();
    if (!em) return;
    setInviteBusy(true);
    setTeamError("");
    inviteProjectMember(projectKey, { email: em, role: inviteRole })
      .then(() => {
        setInviteEmail("");
        reloadTeam();
        refetchProjects();
      })
      .catch((err) => {
        setTeamError(err.response?.data?.error || err.message || "Invite failed");
      })
      .finally(() => setInviteBusy(false));
  };

  const handleRemoveMember = (memberUserId) => {
    removeProjectMember(projectKey, memberUserId)
      .then(() => {
        reloadTeam();
        refetchProjects();
      })
      .catch((err) => setTeamError(err.response?.data?.error || err.message || "Remove failed"));
  };

  const handleChangeMemberRole = (memberUserId, role) => {
    updateProjectMemberRole(projectKey, memberUserId, { role })
      .then(() => reloadTeam())
      .catch((err) => setTeamError(err.response?.data?.error || err.message || "Update failed"));
  };

  const handleRevokeInvite = (invitationId) => {
    revokeProjectInvitation(projectKey, invitationId)
      .then(() => reloadTeam())
      .catch((err) => setTeamError(err.response?.data?.error || err.message || "Revoke failed"));
  };

  const handleDeleteProject = () => {
    setDeleting(true);
    setError("");
    deleteProject(projectKey)
      .then(() => {
        navigate("/");
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to delete project");
        setDeleteDialogOpen(false);
      })
      .finally(() => setDeleting(false));
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !project) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 3 }}>
        <Alert severity="error" action={<Button color="inherit" onClick={() => navigate(`/projects/${projectKey}/sessions`)}>Back</Button>}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate(`/projects/${projectKey}/sessions`)} size="small" aria-label="Back">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h5" fontWeight={700}>
          Project settings
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 0,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          maxWidth: 600,
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 3, pt: 2, pb: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            Project ID
          </Typography>
          <Box
            component="code"
            title={projectKey}
            sx={{
              display: "inline-block",
              px: 1.5,
              py: 0.75,
              borderRadius: 1,
              bgcolor: "action.hover",
              border: "1px solid",
              borderColor: "divider",
              fontFamily: "monospace",
              fontSize: "0.8125rem",
              color: "text.primary",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {projectKey}
          </Box>
        </Box>

        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          sx={{ borderBottom: 1, borderColor: "divider", px: 2, minHeight: 48 }}
        >
          <Tab icon={<SettingsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Project settings" id="project-settings-tab" />
          <Tab icon={<CodeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Integration" id="integration-tab" />
          <Tab icon={<BlockIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Page exclusions" id="page-exclusions-tab" />
          {isOwner ? (
            <Tab icon={<GroupIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Team" id="team-tab" />
          ) : null}
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tabIndex === 0 && (
            <>
              {!canEditSettings && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  You can view settings but only the project owner can change them.
                </Alert>
              )}
              <TextField
                fullWidth
                label="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My app"
                disabled={!canEditSettings}
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <PublicIcon color="action" sx={{ fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={600}>
                  Allowed domains
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Domains that can send recordings. Leave empty to allow any origin.
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="e.g. app.example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddDomain())}
                  disabled={!canEditSettings}
                />
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddDomain}
                  disabled={!canEditSettings || !newDomain.trim()}
                  sx={{ flexShrink: 0 }}
                  aria-label="Add domain"
                >
                  Add
                </Button>
              </Box>
              {allowedDomains.length > 0 ? (
                <List dense sx={{ bgcolor: "action.hover", borderRadius: 1, mb: 2 }}>
                  {allowedDomains.map((domain, index) => (
                    <ListItem key={`${domain}-${index}`}>
                      <ListItemText primary={domain} primaryTypographyProps={{ variant: "body2", fontFamily: "monospace" }} />
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveDomain(index)}
                          aria-label="Remove domain"
                          disabled={!canEditSettings}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No domains added. Any origin can send recordings.
                </Typography>
              )}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, mt: 2 }}>
                <FingerprintIcon color="action" sx={{ fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={600}>
                  QL Device ID
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                When enabled, the SDK collects a persistent device identifier to correlate sessions from the same device (e.g. show &quot;Related sessions&quot; by device in replay). Disabled by default for privacy.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={deviceIdEnabled}
                    onChange={(e) => setDeviceIdEnabled(e.target.checked)}
                    color="primary"
                    disabled={!canEditSettings}
                  />
                }
                label={deviceIdEnabled ? "Device ID enabled — sessions correlated by device" : "Device ID disabled"}
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, mt: 2 }}>
                <ScheduleIcon color="action" sx={{ fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={600}>
                  Data retention
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Sessions are retained for <strong>{project?.retentionDays || 30} days</strong>. Retention is automatically set based on your plan and cannot be customized.
              </Typography>
            </>
          )}

          {tabIndex === 1 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Add this script to your site to start recording sessions.
              </Typography>
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate("/docs/sdk")}
                sx={{ display: "inline-block", mb: 2 }}
              >
                View full SDK documentation →
              </Link>
              <ToggleButtonGroup
                value={integrationMode}
                exclusive
                onChange={(_, v) => v != null && setIntegrationMode(v)}
                size="small"
                sx={{ mb: 2 }}
              >
                <ToggleButton value="developer" aria-label="I'm a developer">
                  I'm a developer
                </ToggleButton>
                <ToggleButton value="ai" aria-label="I use an AI web builder">
                  I use an AI web builder
                </ToggleButton>
              </ToggleButtonGroup>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  position: "relative",
                  fontFamily: "monospace",
                  fontSize: "0.8125rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                <IconButton
                  size="small"
                  onClick={copySnippet}
                  sx={{ position: "absolute", top: 8, right: 8 }}
                  aria-label={integrationMode === "developer" ? "Copy script" : "Copy prompt"}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
                {integrationMode === "developer" ? integrationSnippet : integrationPrompt}
              </Paper>
              {copied && (
                <Typography variant="caption" color="success.main" sx={{ mt: 1, display: "block" }}>
                  Copied to clipboard.
                </Typography>
              )}
              {integrationMode === "ai" && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Copy the prompt above and paste it into your AI assistant so it adds the script in a non-blocking way.
                </Typography>
              )}
            </>
          )}

          {tabIndex === 2 && (
            <>
              {!canEditSettings && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Only the project owner can change page exclusions.
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                URL path or substring. When the page URL contains one of these, the SDK will not record (e.g. <code>/privacy</code>, <code>/admin</code>).
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="e.g. /privacy or /admin/login"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddExcluded())}
                  disabled={!canEditSettings}
                />
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleAddExcluded}
                  disabled={!canEditSettings || !newPattern.trim()}
                  sx={{ flexShrink: 0 }}
                >
                  Add
                </Button>
              </Box>
              {excludedUrls.length > 0 ? (
                <List dense sx={{ bgcolor: "action.hover", borderRadius: 1, mb: 0 }}>
                  {excludedUrls.map((pattern, index) => (
                    <ListItem key={`${pattern}-${index}`}>
                      <ListItemText primary={pattern} primaryTypographyProps={{ variant: "body2", fontFamily: "monospace" }} />
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveExcluded(index)}
                          aria-label="Remove"
                          disabled={!canEditSettings}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No excluded pages. All pages are monitored.
                </Typography>
              )}
            </>
          )}

          {tabIndex === 3 && isOwner && (
            <>
              {!isPro ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Team invitations are a <strong>Pro</strong> feature.{" "}
                  <Link component="button" variant="body2" onClick={() => navigate("/account/upgrade")}>
                    Upgrade to invite teammates
                  </Link>
                  .
                </Alert>
              ) : (
                <>
                  {teamError && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setTeamError("")}>
                      {teamError}
                    </Alert>
                  )}
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Invite by email
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Invited users can view this project. Editors can also manage sessions (e.g. share links). Only you can change project settings or billing.
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "flex-start", mb: 3 }}>
                    <TextField
                      size="small"
                      label="Email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      sx={{ minWidth: 220, flex: 1 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel id="invite-role-label">Role</InputLabel>
                      <Select
                        labelId="invite-role-label"
                        label="Role"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                      >
                        <MenuItem value="viewer">Viewer</MenuItem>
                        <MenuItem value="editor">Editor</MenuItem>
                      </Select>
                    </FormControl>
                    <Button variant="contained" onClick={handleSendInvite} disabled={inviteBusy || !inviteEmail.trim()}>
                      {inviteBusy ? "Sending…" : "Send invite"}
                    </Button>
                  </Box>

                  {teamLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                      <CircularProgress size={32} />
                    </Box>
                  ) : team ? (
                    <>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                        Owner
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {team.owner?.email}
                        {team.owner?.name ? ` (${team.owner.name})` : ""}
                      </Typography>

                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                        Members
                      </Typography>
                      {team.members?.length ? (
                        <List dense sx={{ bgcolor: "action.hover", borderRadius: 1, mb: 2 }}>
                          {team.members.map((m) => (
                            <ListItem key={m.userId}>
                              <ListItemText primary={m.email || m.userId} secondary={m.name || undefined} />
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 1 }}>
                                <FormControl size="small" sx={{ minWidth: 100 }}>
                                  <Select
                                    value={m.role}
                                    onChange={(e) => handleChangeMemberRole(m.userId, e.target.value)}
                                  >
                                    <MenuItem value="viewer">Viewer</MenuItem>
                                    <MenuItem value="editor">Editor</MenuItem>
                                  </Select>
                                </FormControl>
                                <IconButton size="small" aria-label="Remove member" onClick={() => handleRemoveMember(m.userId)}>
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          No members yet.
                        </Typography>
                      )}

                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                        Pending invitations
                      </Typography>
                      {team.pendingInvitations?.length ? (
                        <List dense>
                          {team.pendingInvitations.map((inv) => (
                            <ListItem key={inv.invitationId}>
                              <ListItemText
                                primary={inv.email}
                                secondary={`${inv.role} · sent ${inv.createdAt ? new Date(inv.createdAt).toLocaleString() : ""}`}
                              />
                              <ListItemSecondaryAction>
                                <Button size="small" color="inherit" onClick={() => handleRevokeInvite(inv.invitationId)}>
                                  Revoke
                                </Button>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No pending invitations.
                        </Typography>
                      )}
                    </>
                  ) : null}
                </>
              )}
            </>
          )}

          {(tabIndex === 0 || tabIndex === 2) && canEditSettings && (
            <Button variant="contained" onClick={handleSave} disabled={saving || !hasChanges} sx={{ mt: 3 }}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          )}
        </Box>
      </Paper>

      {isOwner && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "error.main",
            borderRadius: 2,
            maxWidth: 600,
            mt: 3,
          }}
        >
          <Typography variant="h6" fontWeight={600} color="error.main" sx={{ mb: 1 }}>
            Danger zone
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Once you delete a project, there is no going back. This will permanently delete the project and all associated sessions and recordings.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleting}
          >
            Delete project
          </Button>
        </Paper>
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete project?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{project?.name || projectKey}</strong>? This action cannot be undone.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: "error.main" }}>
            This will permanently delete:
          </DialogContentText>
          <Box component="ul" sx={{ mt: 1, pl: 2 }}>
            <Typography component="li" variant="body2" color="text.secondary">
              The project configuration
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              All session recordings
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              All associated data and events
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteProject}
            color="error"
            variant="contained"
            disabled={deleting}
            autoFocus
          >
            {deleting ? "Deleting…" : "Delete project"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
