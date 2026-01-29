import { db } from "/firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const grid = document.getElementById("product-grid");

// If this script is accidentally loaded on a page without the grid, just exit quietly.
if (!grid) {
  console.warn("[Shop] #product-grid not found. Skipping product render.");
} else {
  loadProducts().catch(err => {
    console.error("[Shop] Failed to load products:", err);
    grid.innerHTML = `<p style="text-align:center; opacity:.8;">Couldn't load products right now.</p>`;
  });
}

async function loadProducts() {
  grid.innerHTML = `
    <div class="spinner-container">
      <div class="spinner"></div>
    </div>
  `;

  const snap = await getDocs(collection(db, "Products"));

  // Filter out archived client-side (avoids index setup)
  let products = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.archived);

  // Sort newest first if createdAt exists, otherwise by name
  products.sort((a, b) => {
    const aT = a.createdAt?.seconds || 0;
    const bT = b.createdAt?.seconds || 0;
    if (aT !== bT) return bT - aT;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  if (!products.length) {
    grid.innerHTML = `<p style="text-align:center; opacity:.8;">No products yet.</p>`;
    return;
  }

  grid.innerHTML = products.map(renderCard).join("");
}

function renderCard(p) {
  const name = escapeHtml(p.name || "Untitled");
  const price = Number(p.price);
  const priceText = Number.isFinite(price) ? `£${price.toFixed(2)}` : "";
  const img = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : "/icon-512.png";

  const stock = Number(p.stock);
  const outOfStock = Number.isFinite(stock) && stock <= 0;

  // Your product page uses ?id=...
  const href = `/product/?id=${encodeURIComponent(p.id)}`;

  return `
    <a class="product-card" href="${href}" style="text-decoration:none; color:inherit; position:relative;">
      <img src="${img}" alt="${name}" loading="lazy">
      <div style="padding:14px 14px 16px;">
        <h3 style="margin:0 0 6px; font-size:18px;">${name}</h3>
        ${priceText ? `<p style="margin:0; font-weight:700;">${priceText}</p>` : ``}
        ${outOfStock ? `<p style="margin:8px 0 0; color:#b22; font-weight:700;">Out of stock</p>` : ``}
      </div>
    </a>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}
