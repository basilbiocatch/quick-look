import { alpha } from "@mui/material/styles";

/** Tooltip matching MUI Paper — minimal, no heavy shadow */
export function chartTooltipContentStyle(theme) {
  return {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: Number(theme.shape.borderRadius) || 10,
    fontSize: 12,
    padding: "8px 12px",
    color: theme.palette.text.primary,
    boxShadow: "none",
  };
}

export function chartAxisTick(theme) {
  return { fill: theme.palette.text.secondary, fontSize: 11 };
}

/** Horizontal grid only, very subtle */
export function chartGridStroke(theme) {
  return alpha(theme.palette.divider, 0.45);
}

/** Stacked areas: single-hue steps from primary (minimal, on-brand) */
export function primaryStackStyles(theme, count) {
  const main = theme.palette.primary.main;
  const steps = [0.42, 0.34, 0.27, 0.2, 0.15, 0.1];
  return Array.from({ length: count }, (_, i) => ({
    fill: alpha(main, steps[i] ?? 0.08),
    stroke: alpha(main, Math.min(0.55, (steps[i] ?? 0.08) + 0.12)),
  }));
}

/** Pie segments: primary steps + muted “Other” */
export function pieFillsForData(theme, data) {
  const main = theme.palette.primary.main;
  const steps = [0.5, 0.38, 0.28, 0.2, 0.14, 0.1];
  let nonOther = 0;
  return data.map((d) => {
    if (d.fullName === "Other") {
      return alpha(theme.palette.text.secondary, 0.32);
    }
    const c = alpha(main, steps[nonOther] ?? 0.08);
    nonOther += 1;
    return c;
  });
}

export const chartMargins = { top: 4, right: 8, left: 4, bottom: 4 };
