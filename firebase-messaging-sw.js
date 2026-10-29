// Impor script Firebase SDK versi modular untuk Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Inisialisasi Firebase di dalam Service Worker menggunakan konfigurasi project Anda
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

// Menangani pesan latar belakang (saat aplikasi ditutup/di latar belakang)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification ? payload.notification.title : "Pesan Baru TriHive";
  const notificationOptions = {
    body: payload.notification ? payload.notification.body : "Anda menerima pesan baru.",
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
