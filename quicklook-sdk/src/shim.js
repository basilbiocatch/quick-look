export function setupQueue() {
  if (typeof window === "undefined") return;
  if (!window.quicklook) {
    window.quicklook = function () {
      (window.quicklook.q = window.quicklook.q || []).push(arguments);
    };
    window.quicklook.q = [];
  }
}
