#!/usr/bin/env node
"use strict";

/**
 * Send a single test email via AWS SES (quicklook.io identity).
 *
 * Usage (from quicklook-server):
 *   node scripts/sendSesTestEmail.js
 *   SES_TEST_TO=someone@example.com node scripts/sendSesTestEmail.js
 *
 * Requires .env (or env):
 *   AWS_REGION       - SES region (e.g. us-east-1)
 *   SES_FROM         - Verified sender (e.g. noreply@quicklook.io)
 *   SES_TEST_TO      - Recipient for this test (or pass as env)
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or default credential chain)
 */

import "dotenv/config";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const FROM = process.env.SES_FROM || "noreply@quicklook.io";
const TO = "basil@nobexinc.com";
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

async function main() {
  if (!TO) {
    console.error("Set SES_TEST_TO (recipient email). Example:");
    console.error("  SES_TEST_TO=you@example.com node scripts/sendSesTestEmail.js");
    process.exit(1);
  }
  if (!REGION) {
    console.error("Set AWS_REGION (e.g. us-east-1).");
    process.exit(1);
  }

  const client = new SESClient({ region: REGION });
  const subject = "Quicklook SES test – " + new Date().toISOString();
  const body = `This is a test email from Quicklook (AWS SES).

Sent at: ${new Date().toISOString()}
From: ${FROM}
To: ${TO}
Region: ${REGION}

If you received this, SES for quicklook.io is working.`;

  const command = new SendEmailCommand({
    Source: FROM,
    Destination: { ToAddresses: [TO] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: body, Charset: "UTF-8" },
      },
    },
  });

  try {
    const result = await client.send(command);
    console.log("Sent successfully.");
    console.log("MessageId:", result.MessageId);
    console.log("To:", TO);
    console.log("From:", FROM);
  } catch (err) {
    console.error("SES send failed:", err.message);
    if (err.name === "MessageRejected") {
      console.error("Check: SES sandbox only allows sending to verified addresses until production access.");
    }
    process.exit(1);
  }
}

main();
