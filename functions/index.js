// Firebase Cloud Functions — scheduled streak reminder push notifications
// Deploy with: firebase deploy --only functions
//
// Requires: firebase-admin, firebase-functions
// Run `npm install` inside this functions/ directory first.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// Runs every hour on the hour. Checks each user's reminder time
// and sends a push if they haven't checked in today.
exports.streakReminder = onSchedule("every 60 minutes", async () => {
  const now = new Date();
  const currentHour = now.getHours();
  const today = now.toISOString().split("T")[0];

  const usersSnap = await db.collection("users").get();
  const messages = [];

  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    // Skip users who already checked in or have no FCM token
    if (u.lastCheckIn === today) return;
    if (!u.fcmToken) return;
    if (!u.reminderEnabled) return;

    // reminderHour is stored 0-23 (parsed from "21:00" client-side)
    const reminderHour = u.reminderHour ?? 21;
    if (reminderHour !== currentHour) return;

    // Skip if excuse is active
    if (u.excuseActive && new Date(u.excuseActive.until) >= now) return;

    const streak = u.streak || 0;
    messages.push({
      token: u.fcmToken,
      notification: {
        title: streak > 0 ? `🔥 Don't break your ${streak}-day streak!` : "⚡ Time to check in",
        body: streak > 0
          ? "You haven't checked in today. Keep the grind alive."
          : "Log today's habits and earn XP.",
      },
      data: { url: "/" },
    });
  });

  // Send in batches of 500 (FCM limit)
  const messaging = getMessaging();
  for (let i = 0; i < messages.length; i += 500) {
    const batch = messages.slice(i, i + 500);
    if (batch.length) await messaging.sendEach(batch);
  }

  console.log(`Sent ${messages.length} streak reminders at hour ${currentHour}`);
  return null;
});
