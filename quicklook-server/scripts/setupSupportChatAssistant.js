#!/usr/bin/env node
"use strict";

/**
 * One-time setup: Create OpenAI Assistant with file_search and upload README/docs to a vector store.
 * Run from quicklook-server: node scripts/setupSupportChatAssistant.js
 *
 * Requires .env: OPENAI_API_KEY
 * Optional: OPENAI_ASSISTANT_ID, OPENAI_VECTOR_STORE_ID — if set, only uploads new files to existing vector store.
 *
 * Writes OPENAI_ASSISTANT_ID and OPENAI_VECTOR_STORE_ID to .env if new resources are created.
 */

import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

/** Paths relative to repo root. Add more as needed. */
const KNOWLEDGE_BASE_FILES = [
  "SUPPORT-README.md",
  "docs/sdk-javascript-integration.md",
  "README.md",
  "quicklook-sdk/README.md",
];

const ASSISTANT_NAME = "QuickLook Support";
const ASSISTANT_MODEL = "gpt-4o";
const BASE_INSTRUCTIONS = `You are a friendly and empathetic support agent for QuickLook, a session recording and UX analytics product. Your goal is to help users with their questions and issues in a warm, conversational, and human way. Use the knowledge base (uploaded documentation) to answer accurately. Be conversational, use contractions, show empathy, and when the user is done naturally ask if you've answered all their concerns.`;

const NOTIFY_TEAM_TOOL = {
  type: "function",
  function: {
    name: "notify_team",
    description:
      "Call this when the customer is clearly frustrated, is asking for a refund, or has asked to speak to a human or get more help. This notifies the team to follow up.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          enum: ["frustrated", "refund_request", "needs_more_help"],
          description: "Why the team is being notified.",
        },
        summary: {
          type: "string",
          description: "Brief summary of what the customer said or needs.",
        },
      },
      required: ["reason"],
    },
  },
};

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is required in .env");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });
  let assistantId = process.env.OPENAI_ASSISTANT_ID || "";
  let vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID || "";

  // Resolve absolute paths and filter existing files
  const filesToUpload = KNOWLEDGE_BASE_FILES.map((rel) => path.join(REPO_ROOT, rel)).filter((p) => {
    if (!fs.existsSync(p)) {
      console.warn("Skip (not found):", p);
      return false;
    }
    return true;
  });

  if (filesToUpload.length === 0) {
    console.error("No knowledge base files found. Add paths in KNOWLEDGE_BASE_FILES.");
    process.exit(1);
  }

  // Create or use existing vector store
  if (!vectorStoreId) {
    console.log("Creating vector store...");
    const vs = await openai.vectorStores.create({ name: "quicklook-support-kb" });
    vectorStoreId = vs.id;
    console.log("Vector store ID:", vectorStoreId);
  } else {
    console.log("Using existing vector store:", vectorStoreId);
  }

  // Upload files to vector store
  for (const filePath of filesToUpload) {
    const basename = path.basename(filePath);
    console.log("Uploading", basename, "...");
    try {
      const stream = fs.createReadStream(filePath);
      await openai.vectorStores.files.uploadAndPoll(vectorStoreId, stream, {
        pollIntervalMs: 2000,
      });
      console.log("  done.");
    } catch (err) {
      console.error("  failed:", err.message);
    }
  }

  // Create or update assistant
  const assistantTools = [{ type: "file_search" }, NOTIFY_TEAM_TOOL];
  const toolResources = {
    file_search: {
      vector_store_ids: [vectorStoreId],
    },
  };

  if (!assistantId) {
    console.log("Creating assistant with file_search and notify_team...");
    const assistant = await openai.beta.assistants.create({
      name: ASSISTANT_NAME,
      model: ASSISTANT_MODEL,
      instructions: BASE_INSTRUCTIONS,
      tools: assistantTools,
      tool_resources: toolResources,
    });
    assistantId = assistant.id;
    console.log("Assistant ID:", assistantId);
  } else {
    console.log("Updating existing assistant", assistantId, "to use vector store and notify_team...");
    await openai.beta.assistants.update(assistantId, {
      tools: assistantTools,
      tool_resources: toolResources,
    });
    console.log("Done.");
  }

  // Write .env.example / append to .env
  const envPath = path.join(__dirname, "..", ".env");
  const envLines = [
    "",
    "# Support chat (set by setupSupportChatAssistant.js)",
    `OPENAI_ASSISTANT_ID=${assistantId}`,
    `OPENAI_VECTOR_STORE_ID=${vectorStoreId}`,
  ].join("\n");

  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, "utf8");
    content = content.replace(/\n*# Support chat[\s\S]*?(?=\n[A-Z]|\n$|$)/, "");
    content = content.replace(/\n*OPENAI_ASSISTANT_ID=.*/g, "");
    content = content.replace(/\n*OPENAI_VECTOR_STORE_ID=.*/g, "");
    if (!content.endsWith("\n")) content += "\n";
    content += envLines + "\n";
    fs.writeFileSync(envPath, content);
    console.log("Updated", envPath);
  } else {
    console.log("Add to your .env:");
    console.log(envLines);
  }

  console.log("\nSetup complete. Use OPENAI_ASSISTANT_ID in your server and run support chat.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
