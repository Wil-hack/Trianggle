
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBfAvdE0PZMvytkSaofbFAgk0749E-b_pI",
  authDomain: "trihive-857cd.firebaseapp.com",
  databaseURL: "https://trihive-857cd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "trihive-857cd",
  storageBucket: "trihive-857cd.firebasestorage.app",
  messagingSenderId: "434709340496",
  appId: "1:434709340496:web:3e1206dc10679ddc680c55"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    payload.notification?.title || "TriHive";

  const options = {
    body: payload.notification?.body || "Ada pesan atau panggilan masuk",
    icon: "/favicon.ico",
    data: payload.data || {}
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow("https://wil-hack.github.io/")
  );
});
