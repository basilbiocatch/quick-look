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
    logger.warn("Email not sent (AWS_REGION not set):", { to, subject: subject?.slice(0, 50) });
    return false;
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
