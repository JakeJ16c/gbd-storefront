import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { auth, db, functions } from "/firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-functions.js";

let currentUser = null;
let editMode = false;
let editingAddressId = null;

// =========================
// 👤 Load User Profile + Addresses
// =========================
async function loadUserProfile() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) return resolve();

      currentUser = user;

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          document.getElementById("first-name").value = data.firstName || "";
          document.getElementById("last-name").value = data.lastName || "";
          document.getElementById("phone").value = data.phone || "";
          document.getElementById("birthday").value = data.birthday || "";
          updateSummary(data.firstName, data.lastName, data.phone, data.birthday);
        }

        await renderAddresses();
      } catch (err) {
        console.error("Error loading profile:", err);
      }

      resolve();
    });
  });
}

// =========================
// 📦 Render Address Cards
// =========================
async function renderAddresses() {
  const addressList = document.getElementById("address-list");
  addressList.innerHTML = "";

  const addressRef = collection(db, "users", currentUser.uid, "addresses");
  const snapshot = await getDocs(addressRef);

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const div = document.createElement("div");
    div.className = `address-card ${data.default ? "default" : ""}`;

    div.innerHTML = `
      <div class="address-header">
        <div class="address-line">
          <strong>${data.houseNumber || ""} ${data.street || ""}</strong>
          ${data.default ? '<span class="default-badge">Default</span>' : ""}
        </div>
        <div class="address-details">${data.city || ""}</div>
        <div class="address-details">${data.county || ""}</div>
        <div class="address-details">${data.postcode || ""}</div>
      </div>
      <div class="address-actions">
        ${!data.default ? `<button class="set-default" data-id="${docSnap.id}"><i class="fa-solid fa-star"></i></button>` : ""}
        <button class="edit" data-id="${docSnap.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="delete" data-id="${docSnap.id}"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;

    addressList.appendChild(div);
  });

  attachAddressActions();
}

// =========================
// 🎯 Attach Action Handlers
// =========================
function attachAddressActions() {
  document.querySelectorAll(".set-default").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await setDefaultAddress(id);
    });
  });

    document.querySelectorAll(".edit").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const id = btn.dataset.id;
    const docRef = doc(db, "users", currentUser.uid, "addresses", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return alert("Address not found.");

    const data = docSnap.data();

    // Set form values
    document.getElementById("modal-house-number").value = data.houseNumber || "";
    document.getElementById("modal-street").value = data.street || "";
    document.getElementById("modal-city").value = data.city || "";
    document.getElementById("modal-county").value = data.county || "";
    document.getElementById("modal-postcode").value = data.postcode || "";

    // Clear autocomplete field
    document.getElementById("address-search").value = "";
    document.getElementById("address-search").dataset.placeId = "";

    // Set edit mode
    editMode = true;
    editingAddressId = id;

    // Update modal title
    document.querySelector("#addressModal h3").textContent = "Edit Address";
    
    // Show modal
    document.getElementById("addressModal").classList.add("active");
  });
});

    document.querySelectorAll(".delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault(); // ⛔ Prevent page reload if button is inside a form
        e.stopPropagation(); // ⛔ Stop bubbling up
    
        const id = btn.dataset.id;
        const card = btn.closest(".address-card");
        console.log("🗑 Attempting to delete address with ID:", id);
    
        if (confirm("Delete this address?")) {
          try {
            // 👇 Remove the card from the DOM first for instant UI feedback
            card?.remove();
    
            // 👇 Then delete from Firestore
            await deleteDoc(doc(db, "users", currentUser.uid, "addresses", id));
            console.log("✅ Address deleted:", id);
          } catch (err) {
            console.error("❌ Failed to delete address:", err);
            alert("Something went wrong deleting the address.");
          }
        }
      });
    });

}

// =========================
// 🌟 Set Default Address
// =========================
async function setDefaultAddress(id) {
  const addressRef = collection(db, "users", currentUser.uid, "addresses");
  const snapshot = await getDocs(addressRef);

  const batchOps = [];
  snapshot.forEach((docSnap) => {
    const isDefault = docSnap.id === id;
    batchOps.push(updateDoc(doc(db, "users", currentUser.uid, "addresses", docSnap.id), {
      default: isDefault,
    }));
  });

  await Promise.all(batchOps);
  await renderAddresses();
}

// =========================
// ➕ Add Address Modal
// =========================
function openModal() {
  document.getElementById("addressModal").classList.remove("hidden");
}
function closeModal() {
  document.getElementById("addressModal").classList.remove("active");

  // Reset form & edit mode
  editMode = false;
  editingAddressId = null;
  document.getElementById("addAddressForm").reset();
  document.getElementById("address-search").dataset.placeId = "";
  document.getElementById("address-suggestions").innerHTML = "";
}

async function submitNewAddress(e) {
  e.preventDefault();
  if (!currentUser) return alert("You must be logged in to add an address.");

  let houseNumber = document.getElementById("modal-house-number").value.trim();
  let street = document.getElementById("modal-street").value.trim();
  let city = document.getElementById("modal-city").value.trim();
  let county = document.getElementById("modal-county").value.trim();
  let postcode = document.getElementById("modal-postcode").value.trim().toUpperCase();;

  if (!houseNumber || !street || !city || !county || !postcode) {
    return alert("Please fill in all fields.");
  }

  const payload = { houseNumber, street, city, county, postcode, default: false };

  try {
    const ref = collection(db, "users", currentUser.uid, "addresses");

    if (editMode && editingAddressId) {
      const docRef = doc(ref, editingAddressId);
      await updateDoc(docRef, payload);
    } else {
      await addDoc(ref, payload);
    }

    // Reset and refresh
    editMode = false;
    editingAddressId = null;
    closeModal();
    await renderAddresses();
  } catch (err) {
    console.error("Failed to save address:", err);
    alert("Could not save address.");
  }
}

const countryList = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Mauritania", "Mauritius", "Mexico", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
];

function populateCountryDropdown() {
  const select = document.getElementById("country-select");
  countryList.forEach(country => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    select.appendChild(option);
  });
}

// Run it once DOM is ready
document.addEventListener("DOMContentLoaded", populateCountryDropdown);

// =========================
// ✏️ Toggle Profile Edit Mode with Icon
// =========================
function toggleProfileEditMode(enable) {
  const formBlock = document.getElementById("form-block");
  const summaryBlock = document.getElementById("summary-block");
  const editActions = document.getElementById("edit-actions");

  formBlock.classList.toggle("hidden", !enable);
  summaryBlock.classList.toggle("hidden", enable);
  editActions.classList.toggle("hidden", !enable);

    if (!enable) {
    renderAddresses();
  }
}

// =========================
// 💾 Save Profile Info
// =========================
async function saveProfile(e) {
  e.preventDefault();
  if (!currentUser) return alert("You must be logged in to save your profile.");

  const firstName = document.getElementById("first-name").value.trim();
  const lastName = document.getElementById("last-name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const birthday = document.getElementById("birthday").value.trim();

  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      firstName,
      lastName,
      phone,
      birthday,
    }, { merge: true });

    alert("Profile updated!");
    toggleProfileEditMode(false);
  } catch (err) {
    console.error("Save error:", err);
    alert("Failed to save your profile.");
  }
}

// =========================
// 🧾 Update Summary
// =========================
function updateSummary(firstName, lastName, phone, birthday) {
  document.getElementById("summary-name").textContent = `${firstName || "-"} ${lastName || ""}`;
  document.getElementById("summary-phone").textContent = phone || "-";
  document.getElementById("summary-birthday").textContent = birthday || "Not set";
}

// =========================
// 🚪 Logout
// =========================
function setupLogout() {
  const btn = document.getElementById("logoutBtn");
  if (btn) {
    btn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "/";
    });
  }
}

// =========================
// 🚀 Init Page
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserProfile();

  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveProfile);

  const addAddressBtn = document.getElementById('addAddressBtn');
  const addressModal = document.getElementById('addressModal');
  const closeAddressModal = document.getElementById('closeAddressModal');
  
  addAddressBtn?.addEventListener('click', () => {
    document.querySelector("#addressModal h3").textContent = "Add New Address";
    editMode = false;
    editingAddressId = null;
    document.getElementById("addAddressForm").reset();
    addressModal.classList.add('active');
  });
  
  closeAddressModal?.addEventListener('click', () => {
    addressModal.classList.remove('active');
  });

  const editAccountBtn = document.getElementById("editAccountBtn");
  if (editAccountBtn) editAccountBtn.addEventListener("click", () => toggleProfileEditMode(true));

  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", () => toggleProfileEditMode(false));

  const modalForm = document.getElementById("addAddressForm");
  if (modalForm) modalForm.addEventListener("submit", submitNewAddress);

  window.addEventListener("click", (e) => {
    const addressModal = document.getElementById("addressModal");
    if (e.target === addressModal) {
      addressModal.classList.remove("active");
    }
  });

  const closeModalBtn = document.getElementById("closeAddressModal");
    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", () => {
        document.getElementById("addressModal").classList.remove("active");
      });
    }

  setupLogout();
  initAutocomplete();
});

function initAutocomplete() {
  const addressSearchInput = document.getElementById("address-search");
  const suggestionList = document.getElementById("address-suggestions");

  addressSearchInput.addEventListener("input", async () => {
    const query = addressSearchInput.value.trim();

    if (query.length < 3) {
      suggestionList.innerHTML = "";
      return;
    }

    try {
      const res = await fetch(`https://us-central1-daisy-s-website.cloudfunctions.net/autocompleteAddress?input=${encodeURIComponent(query)}`);
      const result = await res.json();
    
      console.log("🔍 Full autocomplete response:", result); // 👈 add this
    
      const predictions = result.predictions || [];
    
      suggestionList.innerHTML = "";
    
      predictions.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item.description;
        li.classList.add("suggestion-item");
        li.addEventListener("click", () => handleSelectPrediction(item));
        suggestionList.appendChild(li);
      });
    } catch (err) {
      console.error("❌ Address suggestion error:", err);
    }
  });
}

const resolvePlaceId = httpsCallable(functions, 'resolvePlaceId');

async function handleSelectPrediction(prediction) {
  const addressInput = document.getElementById("address-search");
  const suggestionsBox = document.getElementById("address-suggestions");

  const houseInput = document.getElementById("modal-house-number");
  const streetInput = document.getElementById("modal-street");
  const cityInput = document.getElementById("modal-city");
  const countyInput = document.getElementById("modal-county");
  const postcodeInput = document.getElementById("modal-postcode");

  addressInput.value = prediction.description;
  addressInput.dataset.placeId = prediction.place_id;
  suggestionsBox.innerHTML = "";

  try {
    const response = await resolvePlaceId({ placeId: prediction.place_id });
    const data = response.data;

    // Autofill
    houseInput.value = data.houseNumber || '';
    streetInput.value = data.street || '';
    cityInput.value = data.city || '';
    countyInput.value = data.county || '';
    postcodeInput.value = data.postcode || '';
    
    // ✅ Clear the address search input
    addressInput.value = '';

    console.log("📦 Autofilled from place ID:", data);
  } catch (err) {
    console.error("❌ Error resolving place ID:", err);
    alert("Failed to autofill address details.");
  }
}
