"use strict";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { JWT_SECRET } from "../middleware/jwtAuth.js";
import logger from "../configs/loggingConfig.js";

const SALT_ROUNDS = 10;
const JWT_EXPIRY = "7d";

function toUserPayload(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name || "",
    sessionCap: user.sessionCap ?? null,
  };
}

export async function register(req, res) {
  try {
    const { email, password, name } = req.body || {};
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
    const user = new User({
      email: trimmedEmail,
      passwordHash,
      name: typeof name === "string" ? name.trim() : "",
      sessionCap: null,
    });
    await user.save();
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
    return res.status(500).json({ success: false, error: "Login failed" });
  }
}

export async function me(req, res) {
  try {
    const user = await User.findById(req.user.userId).select("email name sessionCap createdAt").lean();
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || "",
        sessionCap: user.sessionCap ?? null,
      },
    });
  } catch (err) {
    logger.error("auth me", { error: err.message });
    return res.status(500).json({ success: false, error: "Failed to load user" });
  }
}
