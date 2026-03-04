"use strict";

/**
 * Require user to have one of the allowed plans. Use after requireAuth.
 * @param {string[]} allowedPlans - e.g. ['pro', 'premium']
 */
export function requirePlan(allowedPlans) {
  return (req, res, next) => {
    const plan = req.user?.plan || "free";
    if (!allowedPlans.includes(plan)) {
      return res.status(403).json({
        error: "Upgrade required",
        requiredPlan: "pro",
        code: "UPGRADE_REQUIRED",
      });
    }
    next();
  };
}
