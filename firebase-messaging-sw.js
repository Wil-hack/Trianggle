// Import Firebase scripts untuk Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Inisialisasi Firebase di Service Worker menggunakan konfigurasi project Anda
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

// Menangani background notification saat aplikasi ditutup atau di latar belakang
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Pesan background diterima: ', payload);
  
  const notificationTitle = payload.notification ? payload.notification.title : 'TriHive';
  const notificationOptions = {
    body: payload.notification ? payload.notification.body : 'Anda memiliki pesan baru.',
    icon: '/favicon.ico' // Sesuaikan ikon jika ada
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
