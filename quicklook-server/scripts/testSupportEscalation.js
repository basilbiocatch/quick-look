#!/usr/bin/env node
"use strict";

/**
 * Test support chat escalation email.
 * Run: node scripts/testSupportEscalation.js
 */

import "dotenv/config";
import { sendSupportEscalationEmail } from "../src/services/emailService.js";

async function main() {
  console.log("Testing support escalation email...");
  console.log("To:", process.env.SUPPORT_ESCALATION_EMAIL || "basil.farraj@gmail.com");
  console.log("AWS_REGION:", process.env.AWS_REGION || "(not set)");
  console.log("SES_FROM:", process.env.SES_FROM || "(not set)");
  console.log("");

  try {
    await sendSupportEscalationEmail({
      reason: "frustrated",
      summary: "Test escalation - customer is frustrated with setup",
      threadId: "thread_test_123",
    });
    console.log("✓ Email sent successfully!");
  } catch (err) {
    console.error("✗ Email failed:", err.message);
    process.exit(1);
  }
}

main();
