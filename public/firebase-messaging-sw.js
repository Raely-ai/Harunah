// Scripts for firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// These values are extracted from the main app config.
firebase.initializeApp({
  projectId: "lasya-app",
  authDomain: "lasya-app.firebaseapp.com",
  messagingSenderId: "654177015558"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// If you would like to customize notifications that are received in the
// background (Web Push) you can do so here. Check out the following link
// for more details:
// https://firebase.google.com/docs/cloud-messaging/js/receive#handle_messages_while_in_the_background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || "Yeni Bildirim";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "",
    icon: '/logo.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// IMPORTANT: Do NOT add a fetch event listener here that intercepts network requests globally.
// This ensures that Firebase Functions and other API calls are NOT blocked by the service worker.
