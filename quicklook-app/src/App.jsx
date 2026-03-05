import { Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import SessionsPage from "./pages/SessionsPage";
import ReplayPage from "./pages/ReplayPage";
import InsightsPage from "./pages/InsightsPage";
import ReportsPage from "./pages/ReportsPage";
import AbTestsPage from "./pages/AbTestsPage";
import AccuracyPage from "./pages/AccuracyPage";
import HomePage from "./pages/HomePage";
import MarketingHomePage from "./pages/MarketingHomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import AccountPage from "./pages/AccountPage";
import PaymentPage from "./pages/PaymentPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import BillingPage from "./pages/BillingPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentCancelPage from "./pages/PaymentCancelPage";
import NewProjectPage from "./pages/NewProjectPage";
import ProjectSettingsPage from "./pages/ProjectSettingsPage";
import SdkDocsPage from "./pages/SdkDocsPage";
import PublicReplayPage from "./pages/PublicReplayPage";
import PlanManagerPage from "./pages/admin/PlanManagerPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import MainNavBar, { NAV_WIDTH } from "./components/MainNavBar";
import VerificationBanner from "./components/VerificationBanner";
import UpgradeBanner from "./components/UpgradeBanner";
import SupportChatBubble from "./components/SupportChatBubble";
import { Box, CircularProgress, useMediaQuery, useTheme } from "@mui/material";
import { useState, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { ProjectsProvider } from "./contexts/ProjectsContext";

function PageTransition({ children }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState("fadeIn");
  const isReplayPage = location.pathname.startsWith("/sessions/");
  const prevIsReplayPage = displayLocation.pathname.startsWith("/sessions/");
  
  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setTransitionStage("fadeOut");
    }
  }, [location.pathname, displayLocation.pathname]);

  useEffect(() => {
    if (transitionStage === "fadeOut") {
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setTransitionStage("fadeIn");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [transitionStage, location]);

  const getAnimation = () => {
    if (transitionStage === "fadeOut") {
      if (prevIsReplayPage && !isReplayPage) {
        return "slideOutToRight 0.3s ease-in";
      }
      return "fadeOut 0.3s ease-in";
    }
    if (isReplayPage && !prevIsReplayPage) {
      return "slideInFromRight 0.4s ease-out";
    }
    if (!isReplayPage && prevIsReplayPage) {
      return "slideInFromLeft 0.4s ease-out";
    }
    return "fadeIn 0.4s ease-out";
  };

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: "100vh",
        position: "relative",
        opacity: transitionStage === "fadeOut" ? 0 : 1,
        transform: transitionStage === "fadeOut" 
          ? (prevIsReplayPage && !isReplayPage ? "translateX(30px)" : "scale(0.98)")
          : "translateX(0) scale(1)",
        transition: transitionStage === "fadeOut" ? "opacity 0.3s ease, transform 0.3s ease" : "none",
        "@keyframes slideInFromRight": {
          "0%": {
            opacity: 0,
            transform: "translateX(30px) scale(0.98)",
          },
          "100%": {
            opacity: 1,
            transform: "translateX(0) scale(1)",
          },
        },
        "@keyframes slideInFromLeft": {
          "0%": {
            opacity: 0,
            transform: "translateX(-30px) scale(0.98)",
          },
          "100%": {
            opacity: 1,
            transform: "translateX(0) scale(1)",
          },
        },
        "@keyframes slideOutToRight": {
          "0%": {
            opacity: 1,
            transform: "translateX(0) scale(1)",
          },
          "100%": {
            opacity: 0,
            transform: "translateX(30px) scale(0.98)",
          },
        },
        "@keyframes fadeIn": {
          "0%": {
            opacity: 0,
            transform: "scale(0.98)",
          },
          "100%": {
            opacity: 1,
            transform: "scale(1)",
          },
        },
        "@keyframes fadeOut": {
          "0%": {
            opacity: 1,
            transform: "scale(1)",
          },
          "100%": {
            opacity: 0,
            transform: "scale(0.98)",
          },
        },
        animation: transitionStage === "fadeIn" ? getAnimation() : undefined,
      }}
    >
      {children}
    </Box>
  );
}

function AppLayout() {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isReplayPage = location.pathname.startsWith("/sessions/");
  const hideNavOnMobileReplay = isReplayPage && isMobile;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {!hideNavOnMobileReplay && <MainNavBar />}
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          marginLeft: hideNavOnMobileReplay ? 0 : `${NAV_WIDTH}px`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {!hideNavOnMobileReplay && <VerificationBanner />}
        {!hideNavOnMobileReplay && <UpgradeBanner />}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

/** At "/" when unauthenticated show marketing; otherwise require auth and show app. */
function RootLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user && location.pathname === "/") {
    return <MarketingHomePage />;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return (
    <ProjectsProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProjectsProvider>
  );
}

function App() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <SupportChatBubble />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="account/upgrade" element={<PaymentPage />} />
          <Route path="account/subscription" element={<SubscriptionPage />} />
          <Route path="account/billing" element={<BillingPage />} />
          <Route path="account/payment-success" element={<PaymentSuccessPage />} />
          <Route path="account/payment-cancel" element={<PaymentCancelPage />} />
          <Route path="projects/new" element={<NewProjectPage />} />
          <Route path="docs/sdk" element={<SdkDocsPage />} />
          <Route
            path="projects/:projectKey/sessions"
            element={
              <PageTransition>
                <SessionsPage />
              </PageTransition>
            }
          />
          <Route
            path="projects/:projectKey/insights"
            element={
              <PageTransition>
                <InsightsPage />
              </PageTransition>
            }
          />
          <Route
            path="projects/:projectKey/reports"
            element={
              <PageTransition>
                <ReportsPage />
              </PageTransition>
            }
          />
          <Route
            path="projects/:projectKey/ab-tests"
            element={
              <PageTransition>
                <AbTestsPage />
              </PageTransition>
            }
          />
          <Route
            path="projects/:projectKey/accuracy"
            element={
              <PageTransition>
                <AccuracyPage />
              </PageTransition>
            }
          />
          <Route
            path="projects/:projectKey/settings"
            element={
              <PageTransition>
                <ProjectSettingsPage />
              </PageTransition>
            }
          />
          <Route
            path="sessions/:sessionId"
            element={
              <PageTransition>
                <ReplayPage />
              </PageTransition>
            }
          />
          <Route path="admin" element={<AdminRoute><Outlet /></AdminRoute>}>
            <Route path="plans" element={<PlanManagerPage />} />
            <Route path="experiments" element={<PlanManagerPage />} />
            <Route index element={<Navigate to="/admin/plans" replace />} />
          </Route>
        </Route>
        <Route path="/share/:shareToken" element={<PublicReplayPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  );
}

export default App;
