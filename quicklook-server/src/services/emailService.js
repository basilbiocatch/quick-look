"use strict";

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import logger from "../configs/loggingConfig.js";

const FROM = process.env.SES_FROM || "noreply@quicklook.io";
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.APP_BASE_URL || "https://quicklook.io").replace(/\/$/, "");

function getClient() {
  if (!REGION) return null;
  return new SESClient({ region: REGION });
}

/**
 * Send a single email via SES. Returns true if sent, false if SES not configured.
 */
export async function sendEmail({ to, subject, text, html }) {
  const client = getClient();
  if (!client) {
    const msg = "AWS SES not configured (set AWS_REGION in .env)";
    logger.warn(msg, { to, subject: subject?.slice(0, 50) });
    throw new Error(msg);
  }
  try {
    const body = html ? { Html: { Data: html, Charset: "UTF-8" } } : { Text: { Data: text || "", Charset: "UTF-8" } };
    await client.send(
      new SendEmailCommand({
        Source: FROM,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: body,
        },
      })
    );
    logger.info("Email sent", { to, subject: subject?.slice(0, 50) });
    return true;
  } catch (err) {
    logger.error("Email send failed", { to, error: err.message });
    throw err;
  }
}

/** Welcome + verification email after signup */
export async function sendWelcomeAndVerificationEmail(email, name, token) {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Verify your Quicklook email";
  const text = `Welcome to Quicklook${name ? `, ${name}` : ""}!\n\nPlease verify your email by opening this link:\n${verifyUrl}\n\nThe link expires in 24 hours.\n\n— Quicklook`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p>Welcome to Quicklook${name ? `, ${name}` : ""}!</p>
  <p>Please verify your email by clicking the link below:</p>
  <p><a href="${verifyUrl}" style="color: #6366f1;">Verify my email</a></p>
  <p>The link expires in 24 hours.</p>
  <p>— Quicklook</p>
</body>
</html>`;
  return sendEmail({ to: email, subject, text, html });
}

/**
 * Notify the team when support chat escalates (frustrated customer, refund request, needs more help).
 * Sends to SUPPORT_ESCALATION_EMAIL or basil.farraj@gmail.com.
 */
export async function sendSupportEscalationEmail({ reason, summary, threadId }) {
  const to = process.env.SUPPORT_ESCALATION_EMAIL || "basil.farraj@gmail.com";
  logger.info("Support escalation: sending email", { to, reason, threadId: threadId?.slice(0, 8) });
  const reasonLabel =
    reason === "refund_request"
      ? "Refund request"
      : reason === "frustrated"
        ? "Frustrated customer"
        : "Needs more help";
  const subject = `[QuickLook Support] ${reasonLabel}`;
  const body = [
    `QuickLook support chat escalation`,
    ``,
    `Reason: ${reasonLabel}`,
    summary ? `Summary: ${summary}` : null,
    threadId ? `Thread ID: ${threadId}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p><strong>QuickLook support chat escalation</strong></p>
  <p><strong>Reason:</strong> ${reasonLabel}</p>
  ${summary ? `<p><strong>Summary:</strong> ${escapeHtml(summary)}</p>` : ""}
  ${threadId ? `<p><strong>Thread ID:</strong> <code>${escapeHtml(threadId)}</code></p>` : ""}
  <p>— QuickLook Support</p>
</body>
</html>`;
  return sendEmail({ to, subject, text: body, html });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Forgot password: send reset link */
export async function sendResetPasswordEmail(email, token) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your Quicklook password";
  const text = `You requested a password reset. Open this link to set a new password:\n${resetUrl}\n\nThe link expires in 1 hour. If you didn't request this, ignore this email.\n\n— Quicklook`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p>You requested a password reset.</p>
  <p><a href="${resetUrl}" style="color: #6366f1;">Set new password</a></p>
  <p>The link expires in 1 hour. If you didn't request this, ignore this email.</p>
  <p>— Quicklook</p>
</body>
</html>`;
  return sendEmail({ to: email, subject, text, html });
}
