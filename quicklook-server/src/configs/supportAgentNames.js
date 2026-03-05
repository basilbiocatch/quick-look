"use strict";

/** Pool of 10 support agent names; one is randomly assigned per new chat thread. */
export const SUPPORT_AGENT_NAMES = [
  "Alex Martinez",
  "Jordan Lee",
  "Taylor Kim",
  "Sam Patel",
  "Morgan Chen",
  "Casey Johnson",
  "Jamie Williams",
  "Riley Thompson",
  "Avery Brown",
  "Drew Anderson",
];

export function pickRandomAgentName() {
  return SUPPORT_AGENT_NAMES[Math.floor(Math.random() * SUPPORT_AGENT_NAMES.length)];
}
