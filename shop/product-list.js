import { db } from "/firebase.js";
import {collection,getDocs} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

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

function renderProductCard(product, { wishlistFilled = false } = {}) {
  const img = product.images?.[0] || "/icon-512.png";
  const price = Number(product.price || 0).toFixed(2);

  const card = document.createElement("div");
  card.className = "product-card";

  card.innerHTML = `
    <div class="product-image-wrap">
      <img class="product-img" src="${img}" alt="${product.name || "Product"}" />
      <button class="wishlist-btn" title="Wishlist" aria-label="Wishlist">
        <i class="${wishlistFilled ? "fa-solid" : "fa-regular"} fa-heart"></i>
      </button>
    </div>

    <div class="product-info">
      <h3 class="product-name">${product.name || ""}</h3>
      <div class="product-price">£${price}</div>
    </div>

    <div class="product-actions">
      <button class="btn-secondary add-btn">Add to Basket</button>
      <button class="btn-primary buy-btn">Buy Now</button>
    </div>
  `;

  card.querySelector(".product-img").onclick = () => {
    location.href = `/product/?id=${product.id}`;
  };
  card.querySelector(".product-name").onclick = () => {
    location.href = `/product/?id=${product.id}`;
  };

  // TODO: wire these to YOUR existing basket + wishlist functions
  card.querySelector(".add-btn").onclick = () => addToBasket(product);
  card.querySelector(".buy-btn").onclick = () => buyNow(product);

  card.querySelector(".wishlist-btn").onclick = (e) => {
    e.stopPropagation();
    toggleWishlist(product, card.querySelector(".wishlist-btn i"));
  };

  return card;
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
