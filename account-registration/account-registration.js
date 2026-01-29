// Import Firebase setup and needed functions
import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { doc, setDoc, collection, addDoc, getCountFromServer } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';

// Reference to the form element
const form = document.getElementById('register-form');

// 🌍 Get city from IP (non-blocking, but awaited)
async function getUserCity() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    return data.city || "";
  } catch (err) {
    console.warn("Could not fetch city from IP:", err);
    return "";
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const firstName = document.getElementById('first-name').value.trim();
  const lastName = document.getElementById('last-name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (password !== confirmPassword) {
    showToast("Passwords do not match.");
    return;
  }

  try {
    // 🌍 Get user location
    const city = await getUserCity();

    // ✅ Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // ✅ Set display name for account
    await updateProfile(user, {
      displayName: `${firstName} ${lastName}`
    });

    // ✅ Save user info in Firestore under correct structure (by UID)
    await setDoc(doc(db, "users", user.uid), {
      firstName,
      lastName,
      email,
      city,
      createdAt: new Date()
    });

    // ✅ Send email verification
    await sendEmailVerification(user);

    // ✅ Success toast + redirect
    showToast("Verification email sent! Please check your inbox.");
    setTimeout(() => {
      window.location.href = "account.html";
    }, 2500);

  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      showToast(`This email is already registered. Click <a href="login.html" style="color: var(--primary-color); text-decoration: underline;">here</a> to log in.`, 8000);
    } else {
      showToast("Error: " + error.message);
    }
  }
});

// Toast helper
function showToast(message, duration = 4000) {
  const toast = document.getElementById("toast");
  toast.innerHTML = message;
  toast.classList.remove("hidden");
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
  }, duration);
}
