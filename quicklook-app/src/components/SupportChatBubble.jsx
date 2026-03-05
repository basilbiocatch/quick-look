import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  IconButton,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Fab,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CloseIcon from "@mui/icons-material/Close";
import MinimizeIcon from "@mui/icons-material/Remove";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import HistoryIcon from "@mui/icons-material/History";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { sendChatMessage, uploadChatImage, submitSatisfaction, getHistory, getConversation, endConversation } from "../api/supportChatApi";

const STORAGE_KEY_THREAD = "quicklook_support_threadId";
const STORAGE_KEY_AGENT = "quicklook_support_agentName";
const STORAGE_KEY_MESSAGES = "quicklook_support_messages";
const BRAND_COLOR = "#6366f1";
const BRAND_GRADIENT = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)";
const BRAND_GLOW = "rgba(99, 102, 241, 0.4)";
const DARK_BG = "#16161a";
const DARK_BG_ELEVATED = "#1e1e24";
const DARK_BUBBLE = "#27272e";
const DARK_BORDER = "#3f3f48";
const DARK_TEXT = "#e4e4e7";
const DARK_TEXT_MUTED = "#a1a1aa";

const CONNECTING_STEPS = [
  { text: "Connecting to support...", delay: 0 },
  { text: "Finding a representative...", delay: 2000 },
];

function TypingIndicator() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.5 }}>
      <Box
        sx={{
          display: "inline-flex",
          gap: 0.75,
          px: 2,
          py: 1,
          borderRadius: "20px 20px 20px 6px",
          background: `linear-gradient(145deg, ${DARK_BUBBLE} 0%, #2a2a32 100%)`,
          boxShadow: `0 2px 8px rgba(0,0,0,0.25), 0 0 20px ${BRAND_GLOW}20`,
          border: `1px solid ${DARK_BORDER}`,
          "& span": {
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: BRAND_GRADIENT,
            boxShadow: `0 0 12px ${BRAND_GLOW}`,
            animation: "typingBounce 1.2s ease-in-out infinite both",
            "&:nth-of-type(1)": { animationDelay: "0s" },
            "&:nth-of-type(2)": { animationDelay: "0.15s" },
            "&:nth-of-type(3)": { animationDelay: "0.3s" },
          },
          "@keyframes typingBounce": {
            "0%, 70%, 100%": { transform: "scale(0.7) translateY(0)", opacity: 0.6 },
            "35%": { transform: "scale(1.1) translateY(-3px)", opacity: 1 },
          },
        }}
      >
        <span />
        <span />
        <span />
      </Box>
    </Box>
  );
}

function MessageBubble({ message, isUser, agentInitials, index = 0 }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 1.5,
        gap: 1,
        animation: "messageIn 0.35s ease-out both",
        animationDelay: `${Math.min(index * 0.04, 0.2)}s`,
        "@keyframes messageIn": {
          "0%": { opacity: 0, transform: isUser ? "translateX(8px)" : "translateX(-8px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
      }}
    >
      {!isUser && (
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: BRAND_GRADIENT,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 600,
            flexShrink: 0,
            boxShadow: `0 2px 8px ${BRAND_GLOW}`,
            border: "2px solid rgba(255,255,255,0.15)",
          }}
        >
          {agentInitials || "S"}
        </Box>
      )}
      <Paper
        elevation={0}
        sx={{
          maxWidth: isUser ? "75%" : "80%",
          px: 2,
          py: 1.25,
          borderRadius: isUser ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
          background: isUser
            ? BRAND_GRADIENT
            : `linear-gradient(145deg, ${DARK_BUBBLE} 0%, #222228 100%)`,
          color: isUser ? "white" : DARK_TEXT,
          boxShadow: isUser
            ? `0 4px 14px rgba(0,0,0,0.25), 0 0 24px ${BRAND_GLOW}30`
            : `0 2px 10px rgba(0,0,0,0.2), 0 0 1px rgba(255,255,255,0.04)`,
          border: isUser ? "none" : `1px solid ${DARK_BORDER}`,
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          "&:hover": {
            boxShadow: isUser
              ? `0 6px 20px rgba(0,0,0,0.3), 0 0 32px ${BRAND_GLOW}40`
              : `0 4px 14px rgba(0,0,0,0.25)`,
          },
        }}
      >
        <Typography sx={{ fontSize: "0.9375rem", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
          {message.content}
        </Typography>
        {message.imageUrl && (
          <Box
            component="img"
            src={message.imageUrl}
            alt=""
            sx={{
              maxWidth: "100%",
              maxHeight: 200,
              borderRadius: 1.5,
              mt: 1,
              display: "block",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          />
        )}
      </Paper>
    </Box>
  );
}

export default function SupportChatBubble() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY_THREAD) || null;
    } catch {
      return null;
    }
  });
  const [agentName, setAgentName] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY_AGENT) || null;
    } catch {
      return null;
    }
  });
  const [messages, setMessages] = useState(() => {
    try {
      const tid = sessionStorage.getItem(STORAGE_KEY_THREAD);
      if (!tid) return [];
      const raw = sessionStorage.getItem(STORAGE_KEY_MESSAGES);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectingStep, setConnectingStep] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [showSatisfaction, setShowSatisfaction] = useState(false);
  const [satisfactionSent, setSatisfactionSent] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showNewChatOffer, setShowNewChatOffer] = useState(false);
  const [conversationStatus, setConversationStatus] = useState(null); // 'open' | 'closed' | 'satisfied' | null
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageQueueRef = useRef([]);
  const processingRef = useRef(false);
  const threadIdRef = useRef(threadId);
  const assistantCountRef = useRef(0);
  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);
  useEffect(() => {
    assistantCountRef.current = messages.filter((m) => m.role === "assistant").length;
  }, [messages]);

  // Persist messages so chat restores on refresh until user ends the conversation
  useEffect(() => {
    try {
      if (threadId && messages.length > 0) {
        sessionStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      } else if (!threadId) {
        sessionStorage.removeItem(STORAGE_KEY_MESSAGES);
      }
    } catch (_) {}
  }, [threadId, messages]);

  const clearConversation = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY_THREAD);
      sessionStorage.removeItem(STORAGE_KEY_AGENT);
      sessionStorage.removeItem(STORAGE_KEY_MESSAGES);
    } catch (_) {}
    threadIdRef.current = null;
    messageQueueRef.current = [];
    setThreadId(null);
    setAgentName(null);
    setMessages([]);
    setShowSatisfaction(false);
    setSatisfactionSent(false);
    setConnectingStep(null);
    setShowNewChatOffer(true);
    setConversationStatus(null);
  };

  const isConversationEnded = conversationStatus === "closed" || conversationStatus === "satisfied";

  const handleEndChat = async () => {
    try {
      if (threadId) await endConversation({ threadId });
    } catch (_) {}
    clearConversation();
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getHistory();
      setHistoryList(res.data?.conversations || []);
    } catch (err) {
      console.error("Failed to load history:", err);
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadConversation = async (tid) => {
    try {
      const res = await getConversation(tid);
      const conv = res.data?.conversation;
      if (!conv) return;
      clearConversation();
      setShowNewChatOffer(false);
      threadIdRef.current = conv.threadId;
      setThreadId(conv.threadId);
      setAgentName(conv.agentName);
      setMessages(conv.messages || []);
      setConversationStatus(conv.status || "open");
      persistThread(conv.threadId, conv.agentName);
      setShowHistory(false);
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const agentInitials = agentName
    ? agentName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "S";

  useEffect(() => {
    if (open && messages.length === 0 && !threadId && !agentName && !showNewChatOffer) {
      const t1 = setTimeout(() => setConnectingStep(CONNECTING_STEPS[0].text), 300);
      const t2 = setTimeout(() => setConnectingStep(CONNECTING_STEPS[1].text), 2300);
      const t3 = setTimeout(() => {
        setConnectingStep(null);
        setMessages([{ role: "assistant", content: "Hi there! How can I help you today?" }]);
      }, 4200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [open, messages.length, threadId, agentName, showNewChatOffer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, connectingStep]);

  const persistThread = (tid, name) => {
    try {
      if (tid) sessionStorage.setItem(STORAGE_KEY_THREAD, tid);
      if (name) sessionStorage.setItem(STORAGE_KEY_AGENT, name);
    } catch {}
  };

  const processQueue = React.useCallback(async () => {
    if (processingRef.current || messageQueueRef.current.length === 0) return;
    processingRef.current = true;
    setLoading(true);
    if (connectingStep) setConnectingStep(null);

    const item = messageQueueRef.current.shift();
    const { userContent, imageUrl } = item;

    // First 2–3 replies are quick so the user can describe their issue; then realistic delay
    const assistantCount = assistantCountRef.current;
    const typingDelayMs =
      assistantCount < 3
        ? 400 + Math.floor(Math.random() * 1100) // 0.4–1.5 s
        : 1000 + Math.floor(Math.random() * 29000); // 1–30 s
    await new Promise((r) => setTimeout(r, typingDelayMs));

    try {
      const res = await sendChatMessage({
        message: userContent,
        threadId: threadIdRef.current || undefined,
        imageUrl: imageUrl || undefined,
      });
      const data = res.data;
      const reply = data.reply ?? "";
      const newThreadId = data.threadId;
      const newAgentName = data.agentName;

      if (newThreadId) {
        threadIdRef.current = newThreadId;
        setThreadId(newThreadId);
      }
      if (data.isNewThread && newAgentName) {
        setAgentName(newAgentName);
        persistThread(newThreadId, newAgentName);
      }
      setConversationStatus("open");

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 410 && data?.code === "CONVERSATION_ENDED") {
        setConversationStatus("closed");
        setMessages((prev) => [...prev, { role: "assistant", content: "This conversation has ended. Start a new one or choose another from history." }]);
      } else {
        const msg =
          (typeof data?.error === "string" && data.error) ||
          (status === 429 && "You've reached the message limit. Please sign up to continue chatting.") ||
          (status === 503 && "Support chat isn't set up yet. Our team will enable it soon—please check back or contact us directly.") ||
          (status === 502 && "Support is temporarily unavailable. Please try again in a moment.") ||
          "Something went wrong. Please try again.";
        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      }
    } finally {
      setLoading(false);
      processingRef.current = false;
      if (messageQueueRef.current.length > 0) processQueue();
    }
  }, [connectingStep]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !imageFile) return;
    if (isConversationEnded) return;

    let imageUrl = null;
    if (imageFile) {
      try {
        const res = await uploadChatImage(imageFile);
        imageUrl = res.data?.imageUrl;
      } catch (err) {
        const msg = err.response?.data?.error || "Image upload failed.";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry, we couldn't upload your image. ${msg}` },
        ]);
        setImageFile(null);
        setImagePreview(null);
        return;
      }
    }

    const userContent = text || (imageUrl ? "See image above" : "");
    setInput("");
    setImageFile(null);
    setImagePreview(null);

    setMessages((prev) => [...prev, { role: "user", content: userContent, imageUrl }]);
    messageQueueRef.current.push({ userContent, imageUrl });
    processQueue();
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSatisfaction = async (rating) => {
    if (satisfactionSent || !threadId) return;
    try {
      await submitSatisfaction({ threadId, rating });
      setSatisfactionSent(true);
      setShowSatisfaction(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Thanks for your feedback! Feel free to reach out anytime." },
      ]);
    } catch {
      setSatisfactionSent(true);
      setShowSatisfaction(false);
    }
  };

  const panelWidth = isMobile ? "100vw" : 400;
  const panelHeight = isMobile ? "100dvh" : 600;

  return (
    <>
      <Fab
        onClick={() => setOpen((o) => !o)}
        sx={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 60,
          height: 60,
          background: BRAND_GRADIENT,
          color: "white",
          boxShadow: `0 6px 20px rgba(0,0,0,0.2), 0 0 32px ${BRAND_GLOW}50`,
          "&:hover": {
            background: BRAND_GRADIENT,
            transform: "scale(1.08)",
            boxShadow: `0 8px 28px rgba(0,0,0,0.25), 0 0 48px ${BRAND_GLOW}60`,
          },
          transition: "transform 0.25s ease, box-shadow 0.25s ease",
          animation: "chatBubbleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
          "@keyframes chatBubbleIn": {
            "0%": { opacity: 0, transform: "translateY(16px) scale(0.9)" },
            "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
          },
          zIndex: 1300,
          border: "1px solid rgba(255,255,255,0.15)",
        }}
        aria-label="Open support chat"
      >
        <Box sx={{ position: "relative" }}>
          <ChatBubbleOutlineIcon sx={{ fontSize: 28 }} />
          <Box
            sx={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #22c55e 0%, #4ade80 100%)",
              border: "2px solid rgba(255,255,255,0.9)",
              boxShadow: "0 0 10px rgba(34, 197, 94, 0.5)",
              animation: "pulse 2s ease-in-out infinite",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1, transform: "scale(1)" },
                "50%": { opacity: 0.85, transform: "scale(1.05)" },
              },
            }}
          />
        </Box>
      </Fab>

      {open && (
        <Paper
          elevation={0}
          sx={{
            position: "fixed",
            bottom: isMobile ? 0 : 90,
            right: isMobile ? 0 : 20,
            width: panelWidth,
            height: panelHeight,
            maxHeight: isMobile ? "100dvh" : "calc(100vh - 100px)",
            borderRadius: isMobile ? 0 : "16px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            bgcolor: DARK_BG,
            boxShadow: `0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06), 0 0 60px ${BRAND_GLOW}15`,
            animation: "panelSlideUp 0.35s cubic-bezier(0.34, 1.2, 0.64, 1)",
            "@keyframes panelSlideUp": {
              "0%": { opacity: 0, transform: "translateY(20px) scale(0.98)" },
              "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
            },
            zIndex: 1301,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              height: 64,
              background: BRAND_GRADIENT,
              color: "white",
              display: "flex",
              alignItems: "center",
              px: 2,
              borderRadius: "16px 16px 0 0",
              boxShadow: `0 4px 20px ${BRAND_GLOW}40`,
              borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.875rem",
                fontWeight: 600,
                mr: 1.5,
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {agentInitials}
            </Box>
            {showHistory ? (
              <IconButton
                size="small"
                onClick={() => setShowHistory(false)}
                sx={{ color: "white", mr: 1 }}
                aria-label="Back"
              >
                <ArrowBackIcon />
              </IconButton>
            ) : null}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {showHistory ? "Conversation History" : agentName || "Support Team"}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {showHistory
                  ? `${historyList.length} conversation${historyList.length !== 1 ? "s" : ""}`
                  : agentName
                    ? "Typically replies instantly"
                    : "We're here to help"}
              </Typography>
            </Box>
            {!showHistory && (
              <IconButton
                size="small"
                onClick={() => {
                  setShowHistory(true);
                  loadHistory();
                }}
                sx={{ color: "white", mr: 0.5 }}
                aria-label="History"
              >
                <HistoryIcon />
              </IconButton>
            )}
            {!showHistory && threadId && !isConversationEnded && (
              <Typography
                component="button"
                variant="caption"
                onClick={handleEndChat}
                sx={{
                  color: "rgba(255,255,255,0.9)",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  mr: 0.5,
                  "&:hover": { color: "white" },
                }}
              >
                End chat
              </Typography>
            )}
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "white" }} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* History or Messages */}
          {showHistory ? (
            <Box
              sx={{
                flex: 1,
                overflow: "auto",
                background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${BRAND_GLOW}08 0%, transparent 50%), ${DARK_BG}`,
                p: 2,
              }}
            >
              {loadingHistory ? (
                <Typography sx={{ color: DARK_TEXT_MUTED, textAlign: "center", py: 4 }}>
                  Loading...
                </Typography>
              ) : historyList.length === 0 ? (
                <Typography sx={{ color: DARK_TEXT_MUTED, textAlign: "center", py: 4 }}>
                  No previous conversations
                </Typography>
              ) : (
                historyList.map((conv) => (
                  <Paper
                    key={conv.threadId}
                    onClick={() => loadConversation(conv.threadId)}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      bgcolor: DARK_BUBBLE,
                      border: `1px solid ${DARK_BORDER}`,
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        bgcolor: "#2f2f38",
                        borderColor: BRAND_COLOR,
                        boxShadow: `0 0 16px ${BRAND_GLOW}30`,
                      },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ color: DARK_TEXT, fontWeight: 600, flex: 1 }}>
                        {conv.agentName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: DARK_TEXT_MUTED }}>
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: DARK_TEXT_MUTED, fontSize: "0.875rem" }} noWrap>
                      {conv.lastMessage || `${conv.messageCount} message${conv.messageCount !== 1 ? "s" : ""}`}
                    </Typography>
                  </Paper>
                ))
              )}
            </Box>
          ) : (
            <Box
            sx={{
              flex: 1,
              overflow: "auto",
              background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${BRAND_GLOW}08 0%, transparent 50%), ${DARK_BG}`,
              p: 2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {showNewChatOffer && !threadId && messages.length === 0 && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 200,
                  textAlign: "center",
                  animation: "fadeIn 0.3s ease-out",
                  "@keyframes fadeIn": { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
                }}
              >
                <Typography sx={{ color: DARK_TEXT, mb: 2, fontSize: "1rem" }}>
                  Conversation ended.
                </Typography>
                <Typography sx={{ color: DARK_TEXT_MUTED, mb: 2, fontSize: "0.9375rem" }}>
                  Would you like to start a new one?
                </Typography>
                <Box
                  component="button"
                  onClick={() => setShowNewChatOffer(false)}
                  sx={{
                    px: 2.5,
                    py: 1.25,
                    borderRadius: "12px",
                    border: "none",
                    background: BRAND_GRADIENT,
                    color: "white",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: `0 4px 14px ${BRAND_GLOW}50`,
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "scale(1.02)",
                      boxShadow: `0 6px 20px ${BRAND_GLOW}60`,
                    },
                  }}
                >
                  Start new conversation
                </Box>
              </Box>
            )}
            {!showNewChatOffer && connectingStep && messages.length === 0 && (
              <Box
                sx={{
                  textAlign: "center",
                  py: 3,
                  animation: "fadeIn 0.5s ease-out",
                  "@keyframes fadeIn": { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
                }}
              >
                <Typography variant="body2" sx={{ color: DARK_TEXT_MUTED, letterSpacing: "0.02em" }}>
                  {connectingStep}
                </Typography>
              </Box>
            )}
            {!showNewChatOffer && messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                isUser={msg.role === "user"}
                agentInitials={agentInitials}
                index={i}
              />
            ))}
            {!showNewChatOffer && loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </Box>
          )}

          {/* Satisfaction trigger: show "Rate this chat" when we have messages */}
          {!showHistory && !showNewChatOffer && messages.length >= 2 && !showSatisfaction && !satisfactionSent && threadId && (
            <Box sx={{ px: 2, py: 0.5, bgcolor: DARK_BG, borderTop: `1px solid ${DARK_BORDER}` }}>
              <Typography
                component="button"
                variant="caption"
                onClick={() => setShowSatisfaction(true)}
                sx={{
                  color: "#a5b4fc",
                  cursor: "pointer",
                  border: "none",
                  background: "none",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                  transition: "color 0.2s ease",
                  "&:hover": { color: "#c4b5fd" },
                }}
              >
                Rate this conversation
              </Typography>
            </Box>
          )}
          {/* Satisfaction */}
          {!showHistory && !showNewChatOffer && showSatisfaction && !satisfactionSent && threadId && (
            <Box sx={{ px: 2, py: 1, bgcolor: DARK_BG_ELEVATED, borderTop: `1px solid ${DARK_BORDER}` }}>
              <Typography variant="caption" display="block" sx={{ mb: 0.5, color: DARK_TEXT_MUTED }}>
                Did we answer all your concerns?
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {[1, 2, 3, 4, 5].map((r) => (
                  <IconButton
                    key={r}
                    size="small"
                    onClick={() => handleSatisfaction(r)}
                    sx={{
                      color: DARK_TEXT,
                      bgcolor: DARK_BUBBLE,
                      border: `1px solid ${DARK_BORDER}`,
                      transition: "all 0.2s ease",
                      "&:hover": {
                        bgcolor: "#3f3f48",
                        borderColor: BRAND_COLOR,
                        boxShadow: `0 0 16px ${BRAND_GLOW}30`,
                      },
                    }}
                  >
                    {r}
                  </IconButton>
                ))}
              </Box>
            </Box>
          )}

          {/* Ended conversation message */}
          {!showHistory && !showNewChatOffer && isConversationEnded && (
            <Box
              sx={{
                p: 2,
                borderTop: `1px solid ${DARK_BORDER}`,
                background: DARK_BG_ELEVATED,
                borderRadius: "0 0 16px 16px",
                textAlign: "center",
              }}
            >
              <Typography variant="body2" sx={{ color: DARK_TEXT_MUTED, mb: 1.5 }}>
                This conversation has ended.
              </Typography>
              <Typography
                component="button"
                variant="body2"
                onClick={() => clearConversation()}
                sx={{
                  color: "#a5b4fc",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  "&:hover": { color: "#c4b5fd" },
                }}
              >
                Start a new conversation
              </Typography>
            </Box>
          )}
          {/* Input */}
          {!showHistory && !showNewChatOffer && !isConversationEnded && (
          <Box
            sx={{
              p: 1.5,
              borderTop: `1px solid ${DARK_BORDER}`,
              background: `linear-gradient(180deg, ${DARK_BG_ELEVATED} 0%, ${DARK_BG} 100%)`,
              borderRadius: "0 0 16px 16px",
            }}
          >
            {imagePreview && (
              <Box sx={{ position: "relative", display: "inline-block", mb: 1 }}>
                <Box
                  component="img"
                  src={imagePreview}
                  alt="Preview"
                  sx={{ maxHeight: 60, borderRadius: 1, border: `1px solid ${DARK_BORDER}` }}
                />
                <IconButton
                  size="small"
                  onClick={() => {
                    setImagePreview(null);
                    setImageFile(null);
                  }}
                  sx={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    bgcolor: "grey.600",
                    color: "white",
                    "&:hover": { bgcolor: "grey.700" },
                    width: 20,
                    height: 20,
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            )}
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  bgcolor: DARK_BUBBLE,
                  fontSize: "0.9375rem",
                  color: DARK_TEXT,
                  transition: "box-shadow 0.2s ease",
                  "& fieldset": { borderColor: DARK_BORDER },
                  "&:hover fieldset": { borderColor: "#52525b" },
                  "&.Mui-focused fieldset": {
                    borderColor: BRAND_COLOR,
                    boxShadow: `0 0 0 2px ${BRAND_COLOR}40, 0 0 20px ${BRAND_GLOW}30`,
                  },
                  "& input::placeholder, & textarea::placeholder": {
                    color: DARK_TEXT_MUTED,
                    opacity: 1,
                  },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ alignSelf: "flex-end", mb: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => fileInputRef.current?.click()}
                      sx={{ color: DARK_TEXT_MUTED }}
                      aria-label="Attach image"
                    >
                      <AttachFileIcon fontSize="small" />
                    </IconButton>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      hidden
                      onChange={handleImageSelect}
                    />
                    <IconButton
                      size="small"
                      onClick={handleSend}
                      disabled={!input.trim() && !imageFile}
                      sx={{
                        background: (input.trim() || imageFile) ? BRAND_GRADIENT : DARK_BUBBLE,
                        color: (input.trim() || imageFile) ? "white" : DARK_TEXT_MUTED,
                        border: `1px solid ${(input.trim() || imageFile) ? "rgba(255,255,255,0.2)" : DARK_BORDER}`,
                        "&:hover": {
                          background: (input.trim() || imageFile) ? BRAND_GRADIENT : "#3f3f48",
                          boxShadow: (input.trim() || imageFile) ? `0 0 20px ${BRAND_GLOW}50` : "none",
                        },
                        "&.Mui-disabled": { color: DARK_TEXT_MUTED, bgcolor: DARK_BUBBLE, background: DARK_BUBBLE },
                      }}
                      aria-label="Send"
                    >
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          )}
        </Paper>
      )}
    </>
  );
}
