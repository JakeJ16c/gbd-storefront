import { db } from "/firebase.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  // ONE inject function (works from any page folder)
  const inject = async (slotId, fileName, callback) => {
    const slot = document.getElementById(slotId);
    if (!slot) return;

    try {
      const url = new URL(fileName, import.meta.url); // relative to THIS JS file
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);

      slot.innerHTML = await res.text();

      if (typeof callback === "function") callback();
    } catch (err) {
      console.error(`[inject] ${fileName}`, err);
    }
  };

  inject("announcement-bar-container", "./announcement-bar.html", () => {
    const messages = document.querySelectorAll(".announcement-messages p");
    let index = 0;

    if (messages.length) {
      messages[0].classList.add("active");
      setInterval(() => {
        messages[index].classList.remove("active");
        index = (index + 1) % messages.length;
        messages[index].classList.add("active");
      }, 6000);
    }
  });

  inject("navigation-bar-container", "./navigation-bar.html");
  inject("footer-container", "./footer.html");
});
