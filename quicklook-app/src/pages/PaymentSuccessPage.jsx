import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";
import { useAuth } from "../contexts/AuthContext";
import { confirmCheckout } from "../api/subscriptionApi";

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loadUser } = useAuth();

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    (async () => {
      if (sessionId) {
        try {
          await confirmCheckout(sessionId);
        } catch (_) {
          // Webhook may have already run; continue to refresh user
        }
      }
      await loadUser();
    })();
  }, [searchParams, loadUser]);

  return (
    <Box sx={{ maxWidth: 400, mx: "auto", py: 6, px: 2, textAlign: "center" }}>
      {/* Magical animated check with celebration */}
      <Box
        sx={{
          position: "relative",
          display: "inline-flex",
          mb: 2,
          "& .successFloat": {
            animation: "successFloat 3s ease-in-out infinite",
          },
          "& .successGlow": {
            animation: "successGlow 2s ease-in-out infinite",
          },
          "& .confetti": {
            animation: "confettiPop 0.6s ease-out backwards",
          },
          "@keyframes successFloat": {
            "0%, 100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-8px)" },
          },
          "@keyframes successGlow": {
            "0%, 100%": { opacity: 0.85 },
            "50%": { opacity: 1 },
          },
          "@keyframes confettiPop": {
            "0%": { opacity: 0, transform: "scale(0)" },
            "70%": { transform: "scale(1.1)" },
            "100%": { opacity: 1, transform: "scale(1)" },
          },
        }}
      >
        {/* Celebration burst behind the check */}
        <Box
          className="confetti"
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 120,
            height: 120,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
              <line
                key={i}
                x1="50"
                y1="50"
                x2={50 + 42 * Math.cos((deg * Math.PI) / 180)}
                y2={50 + 42 * Math.sin((deg * Math.PI) / 180)}
                stroke="url(#successBurstGrad)"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity={0.4 - i * 0.02}
              />
            ))}
            <defs>
              <linearGradient id="successBurstGrad" x1="50" y1="8" x2="50" y2="92" gradientUnits="userSpaceOnUse">
                <stop stopColor="#be95fa" stopOpacity="0.8" />
                <stop offset="1" stopColor="#6366f1" stopOpacity="0.3" />
              </linearGradient>
            </defs>
          </svg>
        </Box>

        {/* Celebration sparkles around the check */}
        <Box
          sx={{
            position: "absolute",
            inset: -24,
            pointerEvents: "none",
          }}
        >
          {[
            { left: "0%", top: "20%", delay: "0s", size: 12 },
            { left: "10%", top: "0%", delay: "0.1s", size: 8 },
            { left: "85%", top: "15%", delay: "0.15s", size: 10 },
            { left: "95%", top: "45%", delay: "0.2s", size: 8 },
            { left: "80%", top: "85%", delay: "0.25s", size: 12 },
            { left: "15%", top: "90%", delay: "0.3s", size: 8 },
            { left: "0%", top: "55%", delay: "0.35s", size: 10 },
          ].map((star, i) => (
            <Box
              key={i}
              className="confetti"
              sx={{
                position: "absolute",
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                animationDelay: star.delay,
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
                  fill={`url(#successStarGrad-${i})`}
                />
                <defs>
                  <linearGradient id={`successStarGrad-${i}`} x1="4" y1="2" x2="21" y2="20" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#be95fa" />
                    <stop offset="1" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
            </Box>
          ))}
        </Box>

        {/* Animated circle with checkmark */}
        <Box
          className="successFloat successGlow"
          sx={{
            position: "relative",
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(190, 149, 250, 0.35) 0%, rgba(99, 102, 241, 0.3) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid",
            borderColor: "rgba(190, 149, 250, 0.5)",
            boxShadow: "0 0 24px rgba(190, 149, 250, 0.25)",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            sx={{ flexShrink: 0 }}
          >
            <path
              d="M5 12l5 5 9-10"
              stroke="url(#successCheckGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="successCheckGrad" x1="5" y1="7" x2="19" y2="17" gradientUnits="userSpaceOnUse">
                <stop stopColor="#be95fa" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
        </Box>
      </Box>

      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        Payment successful
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        You're now on Pro. Enjoy AI insights and more.
      </Typography>
      <Button variant="contained" onClick={() => navigate("/")}>
        Go to Dashboard
      </Button>
    </Box>
  );
}
