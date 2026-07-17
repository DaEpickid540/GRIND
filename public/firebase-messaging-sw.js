// Firebase Cloud Messaging service worker
// This handles background push notifications
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

// personal-suite-ca587 (GRIND Web App) — public-safe values
firebase.initializeApp({
  apiKey: "AIzaSyAtRLYEN30W1eL4EwiRGN4x_oOzI-HlJZQ",
  authDomain: "personal-suite-ca587.firebaseapp.com",
  projectId: "personal-suite-ca587",
  messagingSenderId: "894530323591",
  appId: "1:894530323591:web:50666cc948e39e0dfc6422",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(payload.notification?.title || "GRIND", {
    body: payload.notification?.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: payload.data?.url || "/" },
  });
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || "/"));
});
