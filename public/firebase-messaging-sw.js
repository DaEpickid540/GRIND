// Firebase Cloud Messaging service worker
// This handles background push notifications
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

// NOTE: replace with your config (these are public-safe values)
firebase.initializeApp({
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
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
