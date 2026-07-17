export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      console.warn("Service worker не беше регистриран.");
    });
  });
}

export function prepareMobileBrowserChrome() {
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  if (!isIos || isStandalone) return;

  document.documentElement.classList.add("ios-browser-shell");

  const collapseToolbar = () => {
    if (window.scrollY <= 1) {
      window.scrollTo({ top: 1, left: 0, behavior: "auto" });
    }
  };

  window.addEventListener("load", () => window.setTimeout(collapseToolbar, 250));
  window.addEventListener("orientationchange", () => window.setTimeout(collapseToolbar, 450));
  document.addEventListener("touchend", () => window.setTimeout(collapseToolbar, 80), { passive: true });
}
