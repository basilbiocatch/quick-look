import { useAuth } from "../contexts/AuthContext";

export function usePlanFeatures(projectCount = 0) {
  const { user } = useAuth();
  const plan = user?.plan || "free";
  const projectLimit = user?.projectLimit ?? (plan === "pro" ? null : 1);
  const canAccessAI = plan === "pro";
  const canCreateProject = projectLimit === null || projectCount < projectLimit;
  const sessionLimit = user?.sessionCap ?? 1000;
  const retentionDays = plan === "pro" ? 90 : 30;
  const showUpgradeBanner = plan === "free";
  return {
    canAccessAI,
    canCreateProject,
    sessionLimit,
    retentionDays,
    showUpgradeBanner,
    plan,
    projectLimit,
  };
}
