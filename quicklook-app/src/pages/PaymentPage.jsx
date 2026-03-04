import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { createCheckoutSession, getPlansConfig, validateCouponPublic } from "../api/subscriptionApi";

const WIZARD_STEPS = ["Choose plan", "Payment"];

export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const couponParam = searchParams.get("coupon") || "";
  const fromPricing = searchParams.get("from") === "pricing";
  const [activeStep, setActiveStep] = useState(0);
  const [interval, setInterval] = useState("annual");
  const [plans, setPlans] = useState(null);
  const [couponCode, setCouponCode] = useState(couponParam);
  const [couponValid, setCouponValid] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    getPlansConfig()
      .then((res) => setPlans(res.data?.plans || []))
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (couponParam) {
      setCouponCode(couponParam);
      validateCouponPublic(couponParam)
        .then((res) => {
          setCouponValid(res.data?.valid ?? false);
          setCouponError(res.data?.error || "");
        })
        .catch(() => {
          setCouponValid(false);
          setCouponError("Could not validate");
        });
    }
  }, [couponParam]);

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    setCouponError("");
    setCouponValid(null);
    validateCouponPublic(couponCode.trim())
      .then((res) => {
        setCouponValid(res.data?.valid ?? false);
        setCouponError(res.data?.error || "");
      })
      .catch(() => {
        setCouponValid(false);
        setCouponError("Could not validate");
      });
  };

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const res = await createCheckoutSession({
        tier: "pro",
        interval,
        couponCode: couponValid ? couponCode.trim() : undefined,
      });
      const url = res.data?.redirectUrl;
      if (url) window.location.href = url;
      else setCouponError("Checkout not available");
    } catch (err) {
      setCouponError(err.response?.data?.error || err.message || "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const proPlan = plans?.find((p) => p.tier === "pro");
  const monthlyPrice = proPlan?.pricing?.monthly?.displayPrice || "$29/mo";
  const annualPrice = proPlan?.pricing?.annual?.displayPrice || "$290/year";
  const annualEffective = proPlan?.pricing?.annual?.effectiveMonthly || "$24.17/mo";
  const annualSavings = proPlan?.pricing?.annual?.savingsText || "Save $58 (2 months free)";

  const displayPrice = interval === "annual" ? annualPrice : monthlyPrice;
  const displayLabel = interval === "annual" ? "Pro (Annual)" : "Pro (Monthly)";

  const headline = fromPricing ? "Purchase Pro" : "Upgrade to Pro";
  const subline = fromPricing
    ? "One plan. AI insights, more sessions, unlimited projects."
    : "Unlock AI insights, more sessions, and unlimited projects.";

  const wrapperSx = fromPricing
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        animation: "paymentFadeIn 0.35s ease-out",
        "@keyframes paymentFadeIn": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }
    : { minHeight: "100vh", bgcolor: "background.default", p: 3 };

  const paperSx = {
    maxWidth: 560,
    width: "100%",
    mx: "auto",
    p: 4,
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 3,
    ...(fromPricing && {
      boxShadow: "0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)",
      animation: "paymentCardIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      "@keyframes paymentCardIn": {
        from: { opacity: 0, transform: "scale(0.96) translateY(8px)" },
        to: { opacity: 1, transform: "scale(1) translateY(0)" },
      },
    }),
  };

  return (
    <Box sx={wrapperSx}>
      {!fromPricing && (
        <Box sx={{ maxWidth: 560, mx: "auto", mb: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => (activeStep === 0 ? navigate(-1) : setActiveStep(0))}
            color="inherit"
          >
            Back
          </Button>
        </Box>
      )}
      {fromPricing && (
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => (activeStep === 0 ? navigate("/") : setActiveStep(0))}
          sx={{ position: "absolute", top: 24, left: 24, zIndex: 1310, color: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
        >
          Back
        </Button>
      )}
      <Paper elevation={0} sx={paperSx}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 1,
            "& .titleSparkle": {
              animation: "titleFloat 3s ease-in-out infinite",
            },
            "& .titleSparkleSvg": {
              animation: "titleSparkle 2s ease-in-out infinite",
            },
            "@keyframes titleFloat": {
              "0%, 100%": { transform: "translateY(0)" },
              "50%": { transform: "translateY(-3px)" },
            },
            "@keyframes titleSparkle": {
              "0%, 100%": { opacity: 0.7 },
              "50%": { opacity: 1 },
            },
          }}
        >
          <Typography variant="h5" fontWeight={700} component="span">
            {headline}
          </Typography>
          <Box
            className="titleSparkle"
            sx={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(190, 149, 250, 0.3) 0%, rgba(99, 102, 241, 0.25) 100%)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid",
              borderColor: "rgba(190, 149, 250, 0.4)",
              flexShrink: 0,
            }}
          >
            <svg
              className="titleSparkleSvg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
                fill="url(#titleSparkleGrad)"
              />
              <path
                d="M18 14L18.8 16.2L21 17L18.8 17.8L18 20L17.2 17.8L15 17L17.2 16.2L18 14Z"
                fill="url(#titleSparkleGrad)"
                opacity="0.8"
              />
              <path
                d="M6 5L6.5 6.5L8 7L6.5 7.5L6 9L5.5 7.5L4 7L5.5 6.5L6 5Z"
                fill="url(#titleSparkleGrad)"
                opacity="0.7"
              />
              <defs>
                <linearGradient id="titleSparkleGrad" x1="4" y1="2" x2="21" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#be95fa" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </Box>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {subline}
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {WIZARD_STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 0: Choose plan */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Billing interval
            </Typography>
            <ToggleButtonGroup
              value={interval}
              exclusive
              onChange={(_, v) => v != null && setInterval(v)}
              fullWidth
              sx={{ mb: 3 }}
            >
              <ToggleButton value="annual">
                <Box sx={{ textAlign: "center", py: 0.5 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {annualEffective}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {annualPrice}
                  </Typography>
                  <Typography variant="caption" display="block" color="success.main">
                    {annualSavings}
                  </Typography>
                </Box>
              </ToggleButton>
              <ToggleButton value="monthly">
                <Box sx={{ textAlign: "center", py: 0.5 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {monthlyPrice}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Billed monthly
                  </Typography>
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>

            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                  Pro includes
                </Typography>
                <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2, m: 0 }}>
                  {proPlan?.ui?.featureList?.map((f, i) => (
                    <li key={i}>{f}</li>
                  )) || (
                    <>
                      <li>90 days data retention</li>
                      <li>5,000 sessions per month</li>
                      <li>Full AI tools suite</li>
                      <li>Unlimited projects</li>
                      <li>Dev tools in replay</li>
                    </>
                  )}
                </Typography>
              </CardContent>
            </Card>

            <Button variant="contained" size="large" fullWidth onClick={() => setActiveStep(1)}>
              Continue to payment
            </Button>
          </Box>
        )}

        {/* Step 1: Payment (coupon + checkout) */}
        {activeStep === 1 && (
          <Box>
            {/* Order summary */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Order summary
                </Typography>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                  <Typography variant="body1" fontWeight={600}>
                    {displayLabel}
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {displayPrice}
                  </Typography>
                </Box>
                {couponValid === true && couponCode.trim() && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                    <Typography variant="body2" color="success.main">
                      Discount: {couponCode.trim()}
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      Applied
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Coupon on payment step */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
              <LocalOfferIcon fontSize="small" />
              Discount code
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
              <TextField
                size="small"
                placeholder="e.g. LAUNCH50"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  setCouponValid(null);
                  setCouponError("");
                }}
                fullWidth
                sx={{ flex: 1 }}
              />
              <Button variant="outlined" onClick={handleApplyCoupon} disabled={!couponCode.trim()}>
                Apply
              </Button>
            </Box>
            {couponValid === true && (
              <Alert severity="success" sx={{ mb: 2 }}>Coupon applied. Discount will be applied at checkout.</Alert>
            )}
            {couponError && couponValid === false && (
              <Alert severity="error" sx={{ mb: 2 }}>{couponError}</Alert>
            )}

            <Divider sx={{ my: 2 }} />

            {couponError && couponValid !== false && (
              <Alert severity="error" sx={{ mb: 2 }}>{couponError}</Alert>
            )}

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleUpgrade}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? <CircularProgress size={24} color="inherit" /> : "Proceed to checkout"}
            </Button>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5, textAlign: "center" }}>
              You'll be redirected to our secure payment page to complete your purchase.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
