"use strict";

import OpenAI from "openai";
import { pickRandomAgentName } from "../configs/supportAgentNames.js";
import logger from "../configs/loggingConfig.js";
import { sendSupportEscalationEmail } from "./emailService.js";

// Read at use time so production env/secrets (e.g. Cloud Run Secret Manager) are available even if they weren't at module load
function getOpenAIConfig() {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  const assistantId = (process.env.OPENAI_ASSISTANT_ID || "").trim();
  return { apiKey, assistantId };
}

function getOpenAIClient() {
  const { apiKey } = getOpenAIConfig();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

const BASE_INSTRUCTIONS = `You are a friendly and empathetic support agent for QuickLook, a session recording and UX analytics product. Your goal is to help users with their questions and issues in a warm, conversational, and human way.

Tone and style:
- Be conversational and friendly. Use contractions (I'm, you're, let's) and casual language.
- Show empathy. If the user is frustrated or stuck, acknowledge it ("I can see that's frustrating, let me help you sort this out").
- Be patient and helpful. If the answer requires multiple steps, break it down clearly.
- Use the knowledge base to answer questions accurately. If you don't have the answer, be honest and offer to escalate or point to other resources.
- Don't use overly formal language or jargon unless necessary.

Your knowledge base includes product documentation (SUPPORT-README, SDK docs), billing and subscription info, and session recording setup and troubleshooting.

When the user indicates they're done or satisfied, naturally ask if you've answered all their concerns, e.g. "Glad I could help! Did that cover everything you needed today?"

Escalation: If the customer is clearly frustrated, is asking for a refund, or explicitly asks to speak to a human or get more help, call the notify_team function with the appropriate reason (frustrated, refund_request, or needs_more_help) and a brief summary of what they said. Then reassure them that the team has been notified and will follow up. You can still answer their question in the same reply.

Remember: You are a real person helping another person. Be genuine, kind, and helpful.`;

function getInstructionsForAgent(agentName) {
  return `You are ${agentName}. ${BASE_INSTRUCTIONS}`;
}

/**
 * Create a new thread and return threadId and agentName.
 * @returns {{ threadId: string, agentName: string }}
 */
export async function createThread() {
  const openai = getOpenAIClient();
  const { assistantId } = getOpenAIConfig();
  if (!openai) throw new Error("OpenAI client not configured (OPENAI_API_KEY missing)");
  if (!assistantId) throw new Error("OPENAI_ASSISTANT_ID is required");

  const thread = await openai.beta.threads.create();
  const agentName = pickRandomAgentName();
  return { threadId: thread.id, agentName };
}

/**
 * Add user message to thread (text + optional image URL), run assistant, return reply.
 * @param {string} threadId
 * @param {string} agentName - used to override instructions for this run
 * @param {string} message - text content
 * @param {string} [imageUrl] - optional image URL (must be publicly accessible)
 * @returns {Promise<{ reply: string }>}
 */
export async function sendMessage(threadId, agentName, message, imageUrl = null) {
  const openai = getOpenAIClient();
  const { assistantId } = getOpenAIConfig();
  if (!openai) throw new Error("OpenAI client not configured (OPENAI_API_KEY missing)");
  if (!assistantId) throw new Error("OPENAI_ASSISTANT_ID is required");

  const textContent = message && String(message).trim() ? String(message).trim() : null;
  
  let content;
  if (imageUrl && textContent) {
    // Both image and text: use array
    content = [
      { type: "image_url", image_url: { url: imageUrl, detail: "auto" } },
      { type: "text", text: textContent },
    ];
  } else if (imageUrl) {
    // Image only: use array with single image
    content = [{ type: "image_url", image_url: { url: imageUrl, detail: "auto" } }];
  } else if (textContent) {
    // Text only: use string (simpler and preferred by API)
    content = textContent;
  } else {
    throw new Error("Message text or image is required");
  }

  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content,
  });

  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
    instructions: getInstructionsForAgent(agentName),
  });

  logger.info("Support chat: run started", { threadId: threadId.slice(0, 8), runId: run.id });

  // Poll until run completes (handle requires_action for notify_team)
  let runStatus = run.status;
  let runId = run.id;
  let attempts = 0;
  const maxAttempts = 60;
  while (runStatus !== "completed" && runStatus !== "failed" && runStatus !== "cancelled" && runStatus !== "expired") {
    logger.debug("Support chat: run status", { threadId: threadId.slice(0, 8), runId, status: runStatus, attempt: attempts });
    if (runStatus === "requires_action") {
      const updated = await openai.beta.threads.runs.retrieve(threadId, runId);
      const action = updated.required_action;
      const toolCalls = action?.type === "submit_tool_outputs" && action.submit_tool_outputs?.tool_calls;
      if (toolCalls?.length) {
        const toolNames = toolCalls.map((tc) => tc.function?.name).filter(Boolean);
        logger.info("Support chat: run requires_action", { threadId: threadId.slice(0, 8), tools: toolNames });
        const toolOutputs = [];
        for (const tc of toolCalls) {
          const fn = tc.function;
          if (fn?.name === "notify_team") {
            let reason = "needs_more_help";
            let summary = "";
            try {
              const args = JSON.parse(fn.arguments || "{}");
              reason = args.reason || reason;
              summary = args.summary || "";
            } catch (_) {}
            try {
              const sent = await sendSupportEscalationEmail({ reason, summary, threadId });
              if (sent) {
                logger.info("Support escalation email sent", { threadId: threadId.slice(0, 8), reason });
              } else {
                logger.warn("Support escalation email not sent (sendEmail returned false)", { reason });
              }
            } catch (err) {
              logger.error("Support escalation email failed", { error: err.message, reason });
            }
            toolOutputs.push({ tool_call_id: tc.id, output: "The team has been notified and will follow up shortly." });
          } else {
            toolOutputs.push({ tool_call_id: tc.id, output: "Done." });
          }
        }
        await openai.beta.threads.runs.submitToolOutputs(threadId, runId, { tool_outputs: toolOutputs });
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
    const updated = await openai.beta.threads.runs.retrieve(threadId, runId);
    runStatus = updated.status;
    attempts++;
    if (attempts >= maxAttempts) {
      logger.warn("Support chat run timed out", { threadId: threadId.slice(0, 8), runId });
      throw new Error("Support response timed out. Please try again.");
    }
  }

  if (runStatus === "failed") {
    const runWithError = await openai.beta.threads.runs.retrieve(threadId, run.id);
    const lastError = runWithError.last_error?.message || "Unknown error";
    logger.error("Support chat run failed", { threadId: threadId.slice(0, 8), error: lastError });
    throw new Error("Something went wrong. Please try again or contact support.");
  }

  logger.info("Support chat: run completed", { threadId: threadId.slice(0, 8), runId, finalStatus: runStatus });

  const messages = await openai.beta.threads.messages.list(threadId, { order: "desc", limit: 5 });
  const assistantMessage = messages.data.find((m) => m.role === "assistant");
  let reply =
    assistantMessage?.content?.[0]?.type === "text"
      ? assistantMessage.content[0].text.value
      : "I'm sorry, I couldn't generate a response. Can you try again?";

  // Strip OpenAI file-search citation markers (e.g. 【6:0†SUPPORT-README.md】) from the reply
  reply = reply.replace(/【[^】]*】/g, "").replace(/\s{2,}/g, " ").trim();

  return { reply };
}

/**
 * Generate a greeting message for the given agent name (first message in thread).
 */
export function getGreetingMessage(agentName) {
  return `Hi there! I'm ${agentName}. How can I help you today?`;
}

export function isConfigured() {
  const { apiKey, assistantId } = getOpenAIConfig();
  return Boolean(apiKey && assistantId);
}
