"use strict";

import SupportConversation from "../models/supportConversationModel.js";
import * as supportChatService from "../services/supportChatService.js";
import * as supportChatUploadService from "../services/supportChatUploadService.js";
import logger from "../configs/loggingConfig.js";

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || req.ip || "unknown";
}

/**
 * POST /api/support-chat
 * Body: { message: string, threadId?: string, imageUrl?: string }
 * Auth: optional (rate limited by IP when unauthenticated)
 */
export async function postChat(req, res) {
  try {
    const { message, threadId: bodyThreadId, imageUrl } = req.body || {};
    const userId = req.user?.userId ?? null;
    const visitorIp = getClientIp(req);

    if (!supportChatService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Support chat is not configured.",
        code: "NOT_CONFIGURED",
      });
    }

    const hasContent = (message && String(message).trim()) || (imageUrl && String(imageUrl).trim());
    if (!hasContent) {
      return res.status(400).json({
        success: false,
        error: "Message text or image is required.",
      });
    }

    let threadId = bodyThreadId && String(bodyThreadId).trim() ? bodyThreadId : null;
    let agentName = null;
    let isNewThread = false;
    let conversation = null;

    if (threadId) {
      conversation = await SupportConversation.findOne({ threadId }).lean();
      if (!conversation) {
        threadId = null;
      } else {
        if (conversation.status === "closed" || conversation.status === "satisfied") {
          return res.status(410).json({
            success: false,
            error: "This conversation has ended.",
            code: "CONVERSATION_ENDED",
          });
        }
        agentName = conversation.agentName;
      }
    }

    if (!threadId) {
      const created = await supportChatService.createThread();
      threadId = created.threadId;
      agentName = created.agentName;
      isNewThread = true;
      conversation = await SupportConversation.create({
        threadId,
        userId,
        visitorIp,
        agentName,
        messages: [],
        status: "open",
      });
    }

    const userContent = String((message || "").trim());
    const userImageUrl = imageUrl && String(imageUrl).trim() ? imageUrl : undefined;

    const { reply } = await supportChatService.sendMessage(
      threadId,
      agentName,
      userContent,
      userImageUrl
    );

    const now = new Date();
    await SupportConversation.updateOne(
      { threadId },
      {
        $push: {
          messages: [
            { role: "user", content: userContent, imageUrl: userImageUrl, timestamp: now },
            { role: "assistant", content: reply, timestamp: now },
          ],
        },
        updatedAt: now,
      }
    );

    return res.status(200).json({
      success: true,
      reply,
      threadId,
      agentName,
      isNewThread,
    });
  } catch (err) {
    logger.error("Support chat error", { error: err.message });
    const status = err.message.includes("not configured") ? 503 : 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Something went wrong. Please try again.",
    });
  }
}

/**
 * POST /api/support-chat/upload-image
 * Multipart form with "image" file. Returns { imageUrl } (signed GCS URL).
 */
export async function uploadImage(req, res) {
  try {
    if (!supportChatUploadService.isUploadConfigured()) {
      return res.status(503).json({
        success: false,
        error: "Image upload is not configured (GCS_BUCKET required).",
      });
    }

    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({
        success: false,
        error: "No image file provided. Use form field 'image'.",
      });
    }

    const { imageUrl } = await supportChatUploadService.uploadImage(
      file.buffer,
      file.mimetype || "image/png"
    );
    return res.status(200).json({ success: true, imageUrl });
  } catch (err) {
    logger.error("Support chat image upload error", { error: err.message });
    return res.status(400).json({
      success: false,
      error: err.message || "Image upload failed.",
    });
  }
}

/**
 * GET /api/support-chat/history
 * Returns list of conversations for the current user (authenticated) or visitor (by IP).
 * Auth: optional
 */
export async function getHistory(req, res) {
  try {
    const userId = req.user?.userId ?? null;
    const visitorIp = userId ? null : getClientIp(req);

    let query = {};
    if (userId) {
      query.userId = userId;
    } else if (visitorIp) {
      query.visitorIp = visitorIp;
      query.userId = null;
    } else {
      return res.status(200).json({ success: true, conversations: [] });
    }

    const conversations = await SupportConversation.find(query)
      .sort({ updatedAt: -1 })
      .limit(50)
      .select("threadId agentName status createdAt updatedAt messages")
      .lean();

    const formatted = conversations.map((c) => ({
      threadId: c.threadId,
      agentName: c.agentName,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages?.length || 0,
      lastMessage: c.messages?.[c.messages.length - 1]?.content?.slice(0, 100) || "",
    }));

    return res.status(200).json({ success: true, conversations: formatted });
  } catch (err) {
    logger.error("Support chat history error", { error: err.message });
    return res.status(500).json({ success: false, error: "Failed to fetch history." });
  }
}

/**
 * GET /api/support-chat/:threadId
 * Returns full conversation by threadId (must belong to current user/visitor).
 * Auth: optional
 */
export async function getConversation(req, res) {
  try {
    const { threadId } = req.params;
    const userId = req.user?.userId ?? null;
    const visitorIp = userId ? null : getClientIp(req);

    const query = { threadId };
    if (userId) {
      query.userId = userId;
    } else if (visitorIp) {
      query.visitorIp = visitorIp;
      query.userId = null;
    } else {
      return res.status(404).json({ success: false, error: "Conversation not found." });
    }

    const conversation = await SupportConversation.findOne(query).lean();
    if (!conversation) {
      return res.status(404).json({ success: false, error: "Conversation not found." });
    }

    return res.status(200).json({
      success: true,
      conversation: {
        threadId: conversation.threadId,
        agentName: conversation.agentName,
        status: conversation.status,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messages: conversation.messages || [],
      },
    });
  } catch (err) {
    logger.error("Support chat get conversation error", { error: err.message });
    return res.status(500).json({ success: false, error: "Failed to fetch conversation." });
  }
}

/**
 * POST /api/support-chat/end
 * Body: { threadId: string }
 * Marks the conversation as closed (must belong to current user/visitor).
 */
export async function postEndConversation(req, res) {
  try {
    const { threadId } = req.body || {};
    if (!threadId || !String(threadId).trim()) {
      return res.status(400).json({ success: false, error: "threadId is required." });
    }

    const userId = req.user?.userId ?? null;
    const visitorIp = getClientIp(req);

    const query = { threadId: String(threadId).trim() };
    if (userId) {
      query.userId = userId;
    } else {
      query.visitorIp = visitorIp;
      query.userId = null;
    }

    const result = await SupportConversation.updateOne(query, {
      $set: { status: "closed", updatedAt: new Date() },
    });

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: "Conversation not found." });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Support chat end conversation error", { error: err.message });
    return res.status(500).json({ success: false, error: "Failed to end conversation." });
  }
}

/**
 * POST /api/support-chat/satisfaction
 * Body: { threadId: string, rating?: number, feedback?: string }
 * Updates conversation status and satisfaction.
 */
export async function postSatisfaction(req, res) {
  try {
    const { threadId, rating, feedback } = req.body || {};
    if (!threadId || !String(threadId).trim()) {
      return res.status(400).json({ success: false, error: "threadId is required." });
    }

    const update = {
      status: "satisfied",
      updatedAt: new Date(),
    };
    if (typeof rating === "number" && rating >= 1 && rating <= 5) update.satisfactionRating = rating;
    if (feedback && String(feedback).trim()) update.satisfactionFeedback = String(feedback).trim();

    const result = await SupportConversation.updateOne(
      { threadId },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: "Conversation not found." });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Support chat satisfaction error", { error: err.message });
    return res.status(500).json({ success: false, error: "Failed to save feedback." });
  }
}
