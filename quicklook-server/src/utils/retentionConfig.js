"use strict";

/**
 * Get retention days based on plan tier.
 * Retention is automatically set per plan and cannot be customized by users.
 */
export const getRetentionDaysByPlan = (plan) => {
  const RETENTION_BY_PLAN = {
    free: 30,
    standard: 90,
    premium: 180,
    enterprise: 365,
  };
  return RETENTION_BY_PLAN[plan] || RETENTION_BY_PLAN.free;
};
