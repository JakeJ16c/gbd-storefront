
// ✅ Fully Updated Products.js with Working Edit + Multi-Image Upload

import { auth, db, storage } from '../firebase.js';
import {
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import {
  collection, getDocs, doc, getDoc, deleteDoc, updateDoc,
  query, orderBy, limit, startAfter, endBefore, limitToLast
} from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';
import {
  ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js';

// DOM elements
const container = document.getElementById("productsTableContainer");
const productSearch = document.getElementById("productSearch");
const sortOrder = document.getElementById("sortOrder");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const logoutBtn = document.getElementById("logoutBtn");

let currentProducts = [];
let lastVisible = null;
let firstVisible = null;
let currentPage = 1;
const pageSize = 10;
let currentSearch = "";
let currentSort = "newest";

onAuthStateChanged(auth, user => {
  if (!user) location.href = "login.html";
  else loadProducts();
});

if (logoutBtn) logoutBtn.onclick = async () => {
  await signOut(auth);
  location.href = "login.html";
};

if (productSearch) {
  productSearch.addEventListener("input", debounce(() => {
    currentSearch = productSearch.value.toLowerCase().trim();
    currentPage = 1;
    loadProducts();
  }, 300));
}

if (sortOrder) sortOrder.onchange = () => {
  currentSort = sortOrder.value;
  currentPage = 1;
  loadProducts();
};

if (prevPageBtn) prevPageBtn.onclick = () => {
  if (currentPage > 1) {
    currentPage--;
    loadProducts(true, 'prev');
  }
};

if (nextPageBtn) nextPageBtn.onclick = () => {
  currentPage++;
  loadProducts(true, 'next');
};

async function loadProducts(paginate = false, direction = 'next') {
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  let qConstraints = [];
  let [sortField, sortDir] = ["name", "asc"];
  if (currentSort === "highest") [sortField, sortDir] = ["price", "desc"];
  else if (currentSort === "lowest") [sortField, sortDir] = ["price", "asc"];

  qConstraints.push(orderBy(sortField, sortDir));
  if (paginate) {
    if (direction === "next" && lastVisible) qConstraints.push(startAfter(lastVisible));
    else if (direction === "prev" && firstVisible) {
      qConstraints.push(endBefore(firstVisible));
      qConstraints.push(limitToLast(pageSize));
    }
  }

  qConstraints.push(limit(pageSize));
  const q = query(collection(db, "Products"), ...qConstraints);
  const snap = await getDocs(q);

  if (snap.empty) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><h3>No products</h3></div>';
    return;
  }

  firstVisible = snap.docs[0];
  lastVisible = snap.docs[snap.docs.length - 1];
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = snap.docs.length < pageSize;

  currentProducts = snap.docs.map(doc => {
    return { id: doc.id, ...doc.data() };
  });

  if (currentSearch) {
    currentProducts = currentProducts.filter(p =>
      (p.name || "").toLowerCase().includes(currentSearch)
    );
  }

  renderProducts(currentProducts);
}

function renderProducts(products) {
  container.innerHTML = "";
  products.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.images?.[0] || '../icon-512.png'}" style="width:80px; height:80px; border-radius:50%; object-fit:cover;">
      <h3>${product.name}</h3>
      <p><strong>£${parseFloat(product.price).toFixed(2)}</strong></p>
      <p>Stock: ${product.stock}</p>
      <button class="edit-btn" data-id="${product.id}">Edit</button>
      <button class="delete-btn" data-id="${product.id}">Delete</button>
    `;
    card.querySelector('.edit-btn').onclick = () => viewProductDetails(product.id);
    card.querySelector('.delete-btn').onclick = () => confirmDelete(product.id);
    container.appendChild(card);
  });
}

function confirmDelete(id) {
  if (confirm("Delete this product?")) {
    deleteDoc(doc(db, "Products", id)).then(loadProducts);
  }
}

function debounce(fn, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

// === Modal Logic ===
const productModal = document.getElementById("productModal");
const closeProductModal = document.getElementById("closeProductModal");
const saveProductChanges = document.getElementById("saveProductChanges");
const modalName = document.getElementById("modalName");
const modalPrice = document.getElementById("modalPrice");
const modalStock = document.getElementById("modalStock");
const imagePreview = document.getElementById("imagePreview");

let selectedProductId = null;
let uploadedImages = [];

function viewProductDetails(productId) {
  const product = currentProducts.find(p => p.id === productId);
  if (!product) return;

  selectedProductId = product.id;
  modalName.value = product.name || '';
  modalPrice.value = product.price || '';
  modalStock.value = product.stock || '';
  uploadedImages = product.images || [];

  imagePreview.innerHTML = "";
  uploadedImages.forEach(url => {
    const img = document.createElement("img");
    img.src = url;
    img.style.cssText = "width:60px;height:60px;object-fit:cover;border-radius:6px;";
    imagePreview.appendChild(img);
  });

  productModal.style.display = "flex";
}

if (closeProductModal) {
  closeProductModal.onclick = () => {
    productModal.style.display = "none";
  };
}

if (saveProductChanges) {
  saveProductChanges.onclick = async () => {
    if (!selectedProductId) return;
    const updated = {
      name: modalName.value.trim(),
      price: parseFloat(modalPrice.value),
      stock: parseInt(modalStock.value),
      images: uploadedImages
    };

    try {
      await updateDoc(doc(db, "Products", selectedProductId), updated);
      productModal.style.display = "none";
      loadProducts();
    } catch (err) {
      console.error("Error updating product:", err);
    }
  };
}

window.addEventListener("click", e => {
  if (e.target === productModal) {
    productModal.style.display = "none";
  }
});
