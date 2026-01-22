// cookie-banner/load-cookie-banner.js

// ✅ Your storefront GA4 Measurement ID
const GA4_ID = "G-ST5CQ6PV41";

// Store consent here
const CONSENT_KEY = "cookiesAccepted"; // "accepted" | "rejected" | legacy "true"

function hasAccepted() {
  const v = localStorage.getItem(CONSENT_KEY);
  return v === "accepted" || v === "true"; // supports your old value
}

function loadGA4() {
  if (window.__ga4Loaded) return;
  window.__ga4Loaded = true;

  // Inject gtag.js
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`;
  document.head.appendChild(s);

  // Init gtag
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag("js", new Date());
  gtag("config", GA4_ID, { anonymize_ip: true });
}

window.addEventListener("DOMContentLoaded", async () => {
  // If already accepted, load GA and don’t show banner
  if (hasAccepted()) {
    loadGA4();
    return;
  }

  // If explicitly rejected, do nothing
  if (localStorage.getItem(CONSENT_KEY) === "rejected") return;

  // ✅ IMPORTANT: absolute path so it works on /orders/ etc
  fetch("/cookie-banner/cookie-banner.html")
    .then(res => res.text())
    .then(html => {
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.appendChild(container);

      const banner = document.getElementById("cookie-banner");
      const acceptBtn = document.getElementById("accept-cookies");
      const rejectBtn = document.getElementById("reject-cookies");

      if (!banner || !acceptBtn || !rejectBtn) {
        console.warn("Cookie banner elements missing.");
        return;
      }

      banner.style.display = "flex";

      acceptBtn.addEventListener("click", () => {
        localStorage.setItem(CONSENT_KEY, "accepted");
        banner.remove();
        loadGA4();
      });

      rejectBtn.addEventListener("click", () => {
        localStorage.setItem(CONSENT_KEY, "rejected");
        banner.remove();
      });
    })
    .catch(err => console.error("❌ Failed to load cookie banner:", err));
});
