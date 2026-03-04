"use strict";

import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { JWT_SECRET } from "../middleware/jwtAuth.js";
import logger from "../configs/loggingConfig.js";
import { sendWelcomeAndVerificationEmail, sendResetPasswordEmail } from "../services/emailService.js";
import { assignUserToExperimentFromVisitorId } from "../services/planConfigService.js";

const SALT_ROUNDS = 10;
const JWT_EXPIRY = "7d";
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1h

function toUserPayload(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name || "",
    sessionCap: user.sessionCap ?? null,
    plan: user.plan || "free",
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt?.toISOString?.() || null,
  };
}


export async function register(req, res) {
  try {
    const { email, password, name, visitorId } = req.body || {};
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!trimmedEmail) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
    }
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(400).json({ success: false, error: "Email already registered" });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS);
    const user = new User({
      email: trimmedEmail,
      passwordHash,
      name: typeof name === "string" ? name.trim() : "",
      sessionCap: 1000,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpires: verificationExpires,
    });
    await user.save();
    if (visitorId && typeof visitorId === "string" && visitorId.trim()) {
      try {
        await assignUserToExperimentFromVisitorId(user._id.toString(), visitorId.trim());
      } catch (e) {
        logger.warn("Assign experiment from visitor failed (user still created)", { error: e.message });
      }
    }
    try {
      await sendWelcomeAndVerificationEmail(trimmedEmail, user.name, verificationToken);
    } catch (e) {
      logger.warn("Welcome email failed (user still created)", { error: e.message });
    }
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    return res.status(201).json({
      success: true,
      token,
      user: toUserPayload(user),
    });
  } catch (err) {
    logger.error("auth register", { error: err.message });
    return res.status(500).json({ success: false, error: "Registration failed" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!trimmedEmail || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    return res.status(200).json({
      success: true,
      token,
      user: toUserPayload(user),
    });
  } catch (err) {
    logger.error("auth login", { error: err.message });
    const message = process.env.NODE_ENV !== "production" ? err.message : "Login failed";
    return res.status(500).json({ success: false, error: message });
  }
}

export async function me(req, res) {
  try {
    const user = await User.findById(req.user.userId)
      .select("email name sessionCap plan role emailVerified createdAt billing")
      .lean();
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const plan = user.plan || "free";
    const projectLimit = plan === "pro" ? null : 1;
    const payload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name || "",
      sessionCap: user.sessionCap ?? null,
      plan,
      role: user.role || "user",
      subscriptionStatus: user.billing?.status ?? null,
      projectLimit,
      emailVerified: Boolean(user.emailVerified),
      createdAt: user.createdAt?.toISOString?.() || null,
    };
    return res.status(200).json({ success: true, user: payload });
  } catch (err) {
    logger.error("auth me", { error: err.message });
    return res.status(500).json({ success: false, error: "Failed to load user" });
  }
}

export async function verifyEmail(req, res) {
  try {
    const token = (req.query.token || req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ success: false, error: "Verification token is required" });
    }
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid or expired verification link" });
    }
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    user.updatedAt = new Date();
    await user.save();
    return res.status(200).json({ success: true, message: "Email verified" });
  } catch (err) {
    logger.error("auth verifyEmail", { error: err.message });
    return res.status(500).json({ success: false, error: "Verification failed" });
  }
}

export async function forgotPassword(req, res) {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ success: true, message: "If that email is registered, you will receive a reset link" });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    user.updatedAt = new Date();
    await user.save();
    try {
      await sendResetPasswordEmail(user.email, resetToken);
    } catch (e) {
      logger.error("Forgot password email failed", { error: e.message });
      return res.status(500).json({ success: false, error: "Failed to send reset email" });
    }
    return res.status(200).json({ success: true, message: "If that email is registered, you will receive a reset link" });
  } catch (err) {
    logger.error("auth forgotPassword", { error: err.message });
    return res.status(500).json({ success: false, error: "Request failed" });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body || {};
    const trimmedToken = typeof token === "string" ? token.trim() : "";
    if (!trimmedToken) {
      return res.status(400).json({ success: false, error: "Reset token is required" });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
    }
    const user = await User.findOne({
      resetPasswordToken: trimmedToken,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid or expired reset link" });
    }
    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.updatedAt = new Date();
    await user.save();
    return res.status(200).json({ success: true, message: "Password updated" });
  } catch (err) {
    logger.error("auth resetPassword", { error: err.message });
    return res.status(500).json({ success: false, error: "Reset failed" });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || typeof currentPassword !== "string") {
      return res.status(400).json({ success: false, error: "Current password is required" });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "New password must be at least 8 characters" });
    }
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, error: "Current password is incorrect" });
    }
    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.updatedAt = new Date();
    await user.save();
    return res.status(200).json({ success: true, message: "Password updated" });
  } catch (err) {
    logger.error("auth changePassword", { error: err.message });
    return res.status(500).json({ success: false, error: "Update failed" });
  }
}

export async function resendVerificationEmail(req, res) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });
    if (user.emailVerified) {
      return res.status(400).json({ success: false, error: "Email is already verified" });
    }
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    user.emailVerificationTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS);
    user.updatedAt = new Date();
    await user.save();
    try {
      await sendWelcomeAndVerificationEmail(user.email, user.name, verificationToken);
    } catch (e) {
      logger.error("Resend verification email failed", { error: e.message });
      return res.status(500).json({ success: false, error: "Failed to send email" });
    }
    return res.status(200).json({ success: true, message: "Verification email sent" });
  } catch (err) {
    logger.error("auth resendVerificationEmail", { error: err.message });
    return res.status(500).json({ success: false, error: "Request failed" });
  }
}
