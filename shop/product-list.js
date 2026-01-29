import { db } from "/firebase.js";
import { initCheckout } from "/checkout.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

const grid = document.getElementById("product-grid");
const cartKey = "daisyCart";
const wishlistKey = "daisyWishlist";

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

  let products = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.archived);

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

  const wishlist = getWishlistSet();

  grid.innerHTML = "";
  products.forEach(p => {
    const filled = wishlist.has(p.id);
    grid.appendChild(renderProductCard(p, { wishlistFilled: filled }));
  });
}

function renderProductCard(product, { wishlistFilled = false } = {}) {
  const img = product.images?.[0] || "/icon-512.png";
  const price = Number(product.price || 0).toFixed(2);

  const card = document.createElement("div");
  card.className = "product-card";

  card.innerHTML = `
    <div class="image-wrap">
      <img class="product-img" src="${img}" alt="${product.name || "Product"}" />
      <i class="fa-heart wishlist-icon ${wishlistFilled ? "filled fa-solid" : "fa-regular"}"></i>
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

  // Navigate to product page
  card.querySelector(".product-img").onclick = () => (location.href = `/product/?id=${product.id}`);
  card.querySelector(".product-name").onclick = () => (location.href = `/product/?id=${product.id}`);

  // Your existing actions (make sure these exist)
  card.querySelector(".add-btn").onclick = () => addToBasket(product);
  card.querySelector(".buy-btn").onclick = () => buyNow(product);

  // Heart toggle (matches product-detail behaviour)
  const heartIcon = card.querySelector(".wishlist-icon");
  heartIcon.onclick = (e) => {
    e.stopPropagation();

    const willFill = !heartIcon.classList.contains("filled");
    heartIcon.classList.toggle("filled", willFill);
    heartIcon.classList.toggle("fa-solid", willFill);
    heartIcon.classList.toggle("fa-regular", !willFill);

    // call your wishlist function if you have one
    if (typeof toggleWishlist === "function") toggleWishlist(product, heartIcon);
  };

  return card;
}

function handleAddToBasket(product) {
  const sizes = product.sizes && typeof product.sizes === "object" ? product.sizes : null;
  const hasSizes = sizes && Object.keys(sizes).length > 0;

  if (hasSizes) {
    openSizePicker(product, (size) => {
      addToCart(product, size);
      window.updateBasketPreview?.(); // if your dropdown uses this
    });
  } else {
    addToCart(product, null);
    window.updateBasketPreview?.();
  }
}

async function handleBuyNow(product) {
  const sizes = product.sizes && typeof product.sizes === "object" ? product.sizes : null;
  const hasSizes = sizes && Object.keys(sizes).length > 0;

  const run = async (size) => {
    const item = makeCartItem(product, size);
    await initCheckout({ mode: "direct", product: item });
  };

  if (hasSizes) {
    openSizePicker(product, (size) => run(size));
  } else {
    run(null);
  }
}

function makeCartItem(product, selectedSize) {
  const image = product.images?.[0] || "/icon-512.png";
  const safeSize = selectedSize ? String(selectedSize) : null;

  // cart item id should be unique per size
  const cartItemId = safeSize
    ? `${product.id}_${safeSize.replace(/\s+/g, "")}`
    : product.id;

  return {
    id: cartItemId,
    productId: product.id,
    name: product.name || "",
    price: Number(product.price || 0),
    image,
    size: safeSize,
    qty: 1,
    addedAt: Date.now()
  };
}

function addToCart(product, selectedSize) {
  const cart = getCart();
  const item = makeCartItem(product, selectedSize);

  const existing = cart.find(x => x.id === item.id);
  if (existing) existing.qty += 1;
  else cart.push(item);

  setCart(cart);
}

function toggleWishlist(product, iconEl) {
  const wishlist = getWishlistSet();
  const id = product.id;

  const isOn = wishlist.has(id);
  if (isOn) wishlist.delete(id);
  else wishlist.add(id);

  setWishlistSet(wishlist);

  // flip icon
  iconEl.classList.toggle("fa-solid", !isOn);
  iconEl.classList.toggle("fa-regular", isOn);
}

function openSizePicker(product, onPick) {
  const sizes = product.sizes || {};
  const sizeKeys = Object.keys(sizes);

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.35);
    display:flex; align-items:center; justify-content:center;
    z-index:9999; padding:16px;
  `;

  const box = document.createElement("div");
  box.style.cssText = `
    width:min(420px, 100%);
    background:#fff; border-radius:16px; padding:16px;
    box-shadow:0 10px 40px rgba(0,0,0,.2);
  `;

  box.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div style="font-weight:800; font-size:18px;">Choose a size</div>
      <button id="sizeClose" style="border:none;background:transparent;font-size:22px;cursor:pointer;">×</button>
    </div>
    <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:10px;" id="sizeBtns"></div>
  `;

  const btnWrap = box.querySelector("#sizeBtns");

  sizeKeys.forEach(size => {
    const stock = Number(sizes[size] || 0);
    const btn = document.createElement("button");
    btn.textContent = stock > 0 ? `${size}` : `${size} (Sold out)`;
    btn.disabled = stock <= 0;
    btn.style.cssText = `
      padding:10px 12px; border-radius:12px; border:1px solid #ddd;
      cursor:${stock > 0 ? "pointer" : "not-allowed"};
      opacity:${stock > 0 ? "1" : ".5"};
      background:#fff;
    `;
    btn.onclick = () => {
      document.body.removeChild(overlay);
      onPick(size);
    };
    btnWrap.appendChild(btn);
  });

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) document.body.removeChild(overlay);
  });
  box.querySelector("#sizeClose").onclick = () => document.body.removeChild(overlay);
}

function getCart() {
  try { return JSON.parse(localStorage.getItem(cartKey) || "[]"); }
  catch { return []; }
}
function setCart(cart) {
  localStorage.setItem(cartKey, JSON.stringify(cart));
}

function getWishlistSet() {
  try {
    const arr = JSON.parse(localStorage.getItem(wishlistKey) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function setWishlistSet(set) {
  localStorage.setItem(wishlistKey, JSON.stringify([...set]));
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
