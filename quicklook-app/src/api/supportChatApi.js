import axios from "axios";
import { getAuthToken } from "./authApi.js";

const apiBase = import.meta.env.VITE_API_BASE_URL;
const baseURL = apiBase ? apiBase.replace(/\/$/, "") : "";

const api = axios.create({
  baseURL: baseURL || undefined,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Send a support chat message.
 * @param {{ message: string, threadId?: string, imageUrl?: string }} body
 * @returns {Promise<{ data: { reply: string, threadId: string, agentName: string, isNewThread: boolean } }>}
 */
export const sendChatMessage = (body) => api.post("/api/support-chat", body);

/**
 * Upload an image for support chat. Returns signed URL to include in message.
 * @param {File} file
 * @returns {Promise<{ data: { imageUrl: string } }>}
 */
export const uploadChatImage = (file) => {
  const formData = new FormData();
  formData.append("image", file);
  return api.post("/api/support-chat/upload-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

/**
 * Submit satisfaction feedback for a conversation.
 * @param {{ threadId: string, rating?: number, feedback?: string }} body
 */
export const submitSatisfaction = (body) => api.post("/api/support-chat/satisfaction", body);

/**
 * Get conversation history for current user/visitor.
 * @returns {Promise<{ data: { conversations: Array<{ threadId, agentName, status, createdAt, updatedAt, messageCount, lastMessage }> } }>}
 */
export const getHistory = () => api.get("/api/support-chat/history");

/**
 * Get full conversation by threadId.
 * @param {string} threadId
 * @returns {Promise<{ data: { conversation: { threadId, agentName, status, createdAt, updatedAt, messages } } }>}
 */
export const getConversation = (threadId) => api.get(`/api/support-chat/${threadId}`);

/**
 * Mark conversation as ended (closed).
 * @param {{ threadId: string }} body
 */
export const endConversation = (body) => api.post("/api/support-chat/end", body);
