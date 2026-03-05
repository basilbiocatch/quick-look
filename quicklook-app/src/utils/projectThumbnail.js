import { getSessions, getEvents, updateProject } from "../api/quicklookApi";

const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 250;
const RENDER_WAIT_MS = 2500;
const JPEG_QUALITY = 0.7;
const MAX_DATA_URL_WIDTH = 480;

/**
 * Get events up to and including the first full snapshot (type 2) so we have one frame to render.
 * @param {Array} events - rrweb events
 * @returns {Array} events slice
 */
function eventsUpToFirstFrame(events) {
  if (!Array.isArray(events) || events.length === 0) return [];
  const idx = events.findIndex((e) => e.type === 2);
  if (idx === -1) return events.slice(0, 50);
  return events.slice(0, idx + 5);
}

/**
 * Capture a thumbnail from a session's replay and save it as the project cover image.
 * Picks a random session, loads events, renders first frame in a hidden rrweb-player, captures with html2canvas.
 * @param {string} projectKey
 * @param {{ onRefetch?: () => void }} options - optional refetch (e.g. ProjectsContext.refetch) after save
 * @returns {Promise<{ success: boolean, thumbnailUrl?: string }>}
 */
export async function generateAndSaveProjectThumbnail(projectKey, options = {}) {
  const { onRefetch } = options;
  const res = await getSessions({
    projectKey,
    status: "closed",
    limit: 50,
    skip: 0,
  });
  const sessions = res.data?.data || [];
  if (sessions.length === 0) {
    return { success: false };
  }
  const randomSession = sessions[Math.floor(Math.random() * sessions.length)];
  const sessionId = randomSession?.sessionId;
  if (!sessionId) return { success: false };

  const eventsRes = await getEvents(sessionId);
  const events = eventsRes.data?.events || [];
  const frameEvents = eventsUpToFirstFrame(events);
  const hasFullSnapshot = frameEvents.some((e) => e.type === 2);
  if (!hasFullSnapshot) return { success: false };

  const metaEvent = frameEvents.find((e) => e.type === 4);
  const width = metaEvent?.data?.width || 1024;
  const height = metaEvent?.data?.height || 768;
  const eventsWithMeta = frameEvents.map((e) => {
    if (e.type === 4 && (!e.data?.width || !e.data?.height)) {
      return { ...e, data: { ...e.data, width, height } };
    }
    return e;
  });

  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: ${THUMBNAIL_WIDTH}px;
    height: ${THUMBNAIL_HEIGHT}px;
    z-index: -1;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
  `;
  document.body.appendChild(container);

  try {
    const [rrwebPlayerMod, styleMod] = await Promise.all([
      import("rrweb-player"),
      import("rrweb-player/dist/style.css"),
    ]);
    const rrwebPlayer = rrwebPlayerMod?.default;
    if (!rrwebPlayer) throw new Error("rrweb-player not available");

    const playerInstance = new rrwebPlayer({
      target: container,
      props: {
        events: eventsWithMeta,
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
        autoPlay: false,
        showController: false,
        skipInactive: false,
        speed: 1,
        maxScale: 0,
        mouseTail: false,
      },
    });

    if (playerInstance.goto) playerInstance.goto(0, false);

    await new Promise((r) => setTimeout(r, RENDER_WAIT_MS));

    const iframe = container.querySelector("iframe");
    if (!iframe?.contentDocument?.body) {
      throw new Error("Replay iframe not ready");
    }

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(iframe.contentDocument.body, {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
    });

    let dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (canvas.width > MAX_DATA_URL_WIDTH) {
      const small = document.createElement("canvas");
      const r = MAX_DATA_URL_WIDTH / canvas.width;
      small.width = MAX_DATA_URL_WIDTH;
      small.height = Math.round(canvas.height * r);
      const ctx = small.getContext("2d");
      ctx.drawImage(canvas, 0, 0, small.width, small.height);
      dataUrl = small.toDataURL("image/jpeg", JPEG_QUALITY);
    }

    if (typeof playerInstance.destroy === "function") {
      try {
        playerInstance.destroy();
      } catch (_) {}
    }
    container.remove();

    await updateProject(projectKey, { thumbnailUrl: dataUrl });
    if (typeof onRefetch === "function") onRefetch();
    return { success: true, thumbnailUrl: dataUrl };
  } catch (err) {
    if (container.parentNode) container.remove();
    throw err;
  }
}
