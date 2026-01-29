import { db } from "/firebase.js";
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';

document.addEventListener("DOMContentLoaded", () => {
  // Single inject function with callback parameter
  const inject = async (id, file, callback) => {
    try {
      const res = await fetch(file);
      const html = await res.text();
      const container = document.getElementById(id);
      
      if (container) {
        container.innerHTML = html;
        
        // Execute callback after HTML is injected
        if (typeof callback === "function") {
          callback();
        }
      } else {
        console.error(`Container with ID "${id}" not found`);
      }
    } catch (error) {
      console.error(`Error loading ${file}:`, error);
    }
  };

  // Inject announcement bar + fade logic
  inject("announcement-bar-container", "layout/announcement-bar.html", () => {
    const messages = document.querySelectorAll(".announcement-messages p");
    let index = 0;

    if (messages.length > 0) {
      messages[0].classList.add("active");

      setInterval(() => {
        messages[index].classList.remove("active");
        index = (index + 1) % messages.length;
        messages[index].classList.add("active");
      }, 6000);
    }
  });

  // Inject Navigation Bar
    inject("navigation-bar-container", "layout/navigation-bar.html");
  
  // Inject Footer
    inject("footer-container", "layout/footer.html");

});
