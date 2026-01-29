import { db, auth } from "/firebase.js";
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { doc, getDocs, collection, deleteDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';

// 👤 Wait for user login state, load correct basket source
onAuthStateChanged(auth, (user) => {
  if (user) {
    loadFirestoreBasket(user.uid);
  } else {
    loadLocalBasket();
  }
});

// 🔥 Load basket from Firestore (for logged in users)
async function loadFirestoreBasket(uid) {
  const snapshot = await getDocs(collection(db, "users", uid, "Basket"));
  const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderBasket(items, true, uid);
}

// 💾 Load basket from localStorage (for guests)
function loadLocalBasket() {
  const items = JSON.parse(localStorage.getItem("daisyCart") || "[]");
  renderBasket(items, false);
}

// 🎨 Render all basket items and summary
function renderBasket(items, isLoggedIn, uid = null) {
  const basketContainer = document.getElementById("basket-items");
  const emptyMsg = document.getElementById("basket-empty-message");

  basketContainer.innerHTML = "";
  let subtotal = 0;

  if (!items.length) {
    emptyMsg.style.display = "block";
    return;
  }

  emptyMsg.style.display = "none";

  // Loop through basket items and inject rows
  items.forEach((item, index) => {
    const itemTotal = (item.price || 0) * (item.qty || 1);
    subtotal += itemTotal;

    const row = document.createElement("div");
    row.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.4rem 0;
      border-bottom: 1px solid #e3e3e3;
      gap: 1.2rem;
    `;

    row.innerHTML = `
      <img src="${item.image}" alt="${item.name}" style="height: 140px; width: 140px; object-fit: cover; border-radius: 10px;">
      <div style="flex: 1;">
        <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.4rem;">${item.name}</div>
        ${item.size && item.size !== "OneSize" ? `<div style="font-size: 0.85rem; color: #666;">Size: ${item.size}</div>` : ""}
      </div>
      <div class="qty-price-wrapper" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 200px;
        flex: 1;
        gap: 1rem;
      ">
        <!-- Quantity controls will be inserted here -->
        <div class="item-price" style="font-weight: 600; min-width: 64px; text-align: right;">£${itemTotal.toFixed(2)}</div>
      </div>
      <button class="delete-btn" data-index="${index}" style="${delStyle}">
        <i class="fas fa-trash"></i>
      </button>
    `;
         
      // 🔁 Clean pill-style quantity controls
      const quantityControls = document.createElement("div");
      quantityControls.style.display = "inline-flex";
      quantityControls.style.alignItems = "center";
      quantityControls.style.gap = "2px";
      quantityControls.style.border = "1.75px solid black";
      quantityControls.style.borderRadius = "6px";
      quantityControls.style.fontFamily = "'Nunito Sans', sans-serif";
      quantityControls.style.fontSize = "14px";
      quantityControls.style.fontWeight = "600";
      quantityControls.style.backgroundColor = "#fff";
      
      const minus = document.createElement("button");
      minus.textContent = "−";
      minus.style.border = "none";
      minus.style.background = "none";
      minus.style.fontSize = "14px";
      minus.style.cursor = "pointer";
      minus.style.fontWeight = "bold";
      minus.style.padding = "3px 10px";
      minus.style.borderTopLeftRadius = "4px";
      minus.style.borderBottomLeftRadius = "4px";
      minus.style.transition = "transform 0.2s ease";
      minus.onmouseover = () => {
        minus.style.transform = "scale(1.2)";
        minus.style.background = "#FBB6C1";
      };
      minus.onmouseout = () => {
        minus.style.transform = "scale(1)";
        minus.style.background = "none";
      };
      minus.addEventListener("click", (e) => {
      e.stopPropagation();
    
      if (item.qty > 1) {
        item.qty--;
      } else {
        cart.splice(index, 1);
      }
    
      localStorage.setItem(cartKey, JSON.stringify(cart));
      syncBasketToFirestore(cart);
    });
      
      const qty = document.createElement("span");
      qty.textContent = item.qty;
      qty.style.minWidth = "16px";
      qty.style.textAlign = "center";
      
      const plus = document.createElement("button");
      plus.textContent = "+";
      plus.style.border = "none";
      plus.style.background = "none";
      plus.style.fontSize = "14px";
      plus.style.cursor = "pointer";
      plus.style.fontWeight = "bold";
      plus.style.padding = "3px 10px";
      plus.style.borderTopRightRadius = "4px";
      plus.style.borderBottomRightRadius = "4px";
      plus.style.transition = "transform 0.2s ease";
      plus.onmouseover = () => {
        plus.style.transform = "scale(1.2)";
        plus.style.background = "#CCE0FF";
      };
      plus.onmouseout = () => {
        plus.style.transform = "scale(1)";
        plus.style.background = "none";
      };
      plus.addEventListener("click", (e) => {
      e.stopPropagation();
      item.qty++;
    
      localStorage.setItem(cartKey, JSON.stringify(cart));
      syncBasketToFirestore(cart);
    });
      
      quantityControls.appendChild(minus);
      quantityControls.appendChild(qty);
      quantityControls.appendChild(plus);

    const wrapper = row.querySelector('.qty-price-wrapper');
    wrapper.insertBefore(quantityControls, wrapper.firstChild);
    
    basketContainer.appendChild(row);
  });

  renderSummaryBox(subtotal, subtotal);

  // Attach event listeners after render
  document.querySelectorAll(".qty-plus").forEach(btn =>
    btn.addEventListener("click", e => handleQtyChange(e, items, isLoggedIn, uid, 1))
  );

  document.querySelectorAll(".qty-minus").forEach(btn =>
    btn.addEventListener("click", e => handleQtyChange(e, items, isLoggedIn, uid, -1))
  );

  document.querySelectorAll(".delete-btn").forEach(btn =>
    btn.addEventListener("click", e => handleDelete(e, items, isLoggedIn, uid))
  );
}

// ❌ Handle item deletion
async function handleDelete(e, items, isLoggedIn, uid) {
  const index = e.currentTarget.dataset.index;
  const item = items[index];

  if (isLoggedIn) {
    await deleteDoc(doc(db, "users", uid, "Basket", item.id));
    const snapshot = await getDocs(collection(db, "users", uid, "Basket"));
    const updated = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderBasket(updated, true, uid);
  } else {
    items.splice(index, 1);
    localStorage.setItem("daisyCart", JSON.stringify(items));
    renderBasket(items, false);
  }
}

// 🔁 Handle quantity changes
async function handleQtyChange(e, items, isLoggedIn, uid, delta) {
  const index = e.currentTarget.dataset.index;
  const item = items[index];
  item.qty = Math.max(1, (item.qty || 1) + delta);

  if (isLoggedIn) {
    await setDoc(doc(db, "users", uid, "Basket", item.id), item);
    const snapshot = await getDocs(collection(db, "users", uid, "Basket"));
    const updated = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderBasket(updated, true, uid);
  } else {
    items[index] = item;
    localStorage.setItem("daisyCart", JSON.stringify(items));
    renderBasket(items, false);
  }
}

// 📦 Render order summary box
function renderSummaryBox(subtotal = 0, total = 0) {
  const container = document.getElementById("basket-summary");

  // Inject styles if not yet added
  if (!document.getElementById("summary-styles")) {
    const style = document.createElement("style");
    style.id = "summary-styles";
    style.textContent = `
      .payment-icons {
        margin-top: 1rem; 
        text-align: center;
      }
      .icon {
        height: 28px; 
        margin: 0 5px;
      }
    
      .summary-box {
        background: white;
        padding: 2rem;
        padding-bottom: 1rem;
        border-radius: 18px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.06);
        font-size: 0.95rem;
        min-width: 320px;
        max-width: 400px;
        height: fit-content;
      }
      .summary-box h3 {
        font-size: 1.4rem;
        margin-bottom: 1rem;
        color: var(--electric-blue);
      }
      .promo-code {
        display: flex;
        gap: 1rem;
        margin-bottom: 1.2rem;
      }
      .promo-code input {
        flex: 1;
        padding: 0.6rem;
        font-size: 0.95rem;
        border: 1px solid #ccc;
        border-radius: 6px;
      }
      .promo-code button {
        padding: 0.6rem 1rem;
        background: #236b27;
        color: white;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
      }
      .total-line {
        display: flex;
        justify-content: space-between;
        margin: 0.5rem 0;
        font-size: 0.96rem;
      }
      .final-total {
        font-weight: 600;
        font-size: 1.1rem;
      }
      .button-row {
        display: flex;
        flex-direction: column;
        gap: 1.2rem;
        margin-top: 1.5rem;
      }
      .checkout-btn {
        background-color: black;
        color: white;
        border: none;
        padding: 0.75rem 1.25rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 16px;
        font-family: 'Nunito Sans', sans-serif;
        transition: background 0.3s ease;
      }
      .checkout-btn:hover {
        background-color: var(--electric-blue);
      }
      .delete-btn i {
        font-size: 1.2rem;
        color: #e74c3c;
        transition: transform 0.2s ease, color 0.2s ease;
      }
      
      .delete-btn:hover i {
        color: #ff6b6b;
        transform: scale(1.2);
      }
    `;
    document.head.appendChild(style);
  }

  if (!document.getElementById("basket-layout-styles")) {
    const style = document.createElement("style");
    style.id = "basket-layout-styles";
    style.textContent = `
      .basket-layout {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        padding: 2rem;
      }
  
      @media (min-width: 768px) {
        .basket-layout {
          flex-direction: row;
          align-items: flex-start;
          padding: 1rem 8rem;
        }
  
        #basket-items {
          flex: 1;
        }
  
        #basket-summary {
          flex-shrink: 0;
          width: 100%;
          max-width: 400px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  container.innerHTML = `
    <div class="summary-box">
      <h3>Order Summary</h3>
      <div class="promo-code">
        <input type="text" id="promo-code-input" placeholder="Promo Code">
        <button id="apply-promo-btn">Apply</button>
      </div>
      <div class="totals">
        <div class="total-line"><span>Subtotal:</span><span id="subtotal-display-summary">£${subtotal.toFixed(2)}</span></div>
        <div class="total-line"><span>Shipping:</span><span>£0.00</span></div>
        <div class="total-line final-total"><span>Total:</span><span id="total-display-summary">£${total.toFixed(2)}</span></div>
      </div>
      <div class="button-row">
        <button class="checkout-btn" id="checkoutBtn">Proceed to Checkout</button>
      </div>

      <div class="payment-icons">
        <img src="/images/payments/visa.png" alt="Visa" class="icon">
        <img src="/images/payments/mastercard.png" alt="Mastercard" class="icon">
        <img src="/images/payments/american-express.png" alt="AmEx" class="icon">
        <img src="/images/payments/paypal.png" alt="PayPal" class="icon">
      </div>
      
    </div>
  `;

  document.getElementById("checkoutBtn").addEventListener("click", () => {
    import("/checkout.js").then(({ initCheckout }) => {
      initCheckout({ mode: "cart" });
    });
  });
}

// === 💄 Inline Button Styles ===
const btnStyle = `
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
`;

const delStyle = `
  font-size: 1.3rem;
  color: red;
  background: none;
  border: none;
  cursor: pointer;
`;
