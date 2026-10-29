  <!-- Firebase SDKs & Safe Messaging Init -->
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
    import { getDatabase, ref, push, onChildAdded, onChildChanged, set, get, update, remove, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
    import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

    const firebaseConfig = {
      apiKey: "AIzaSyBfAvdE0PZMvytkSaofbFAgk0749E-b_pI",
      authDomain: "trihive-857cd.firebaseapp.com",
      databaseURL: "https://trihive-857cd-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "trihive-857cd",
      storageBucket: "trihive-857cd.firebasestorage.app",
      messagingSenderId: "434709340496",
      appId: "1:434709340496:web:3e1206dc10679ddc680c55"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);

    // Pendaftaran Service Worker yang disesuaikan dengan jalur relatif/subfolder
    try {
      const messaging = getMessaging(app);
      if ('serviceWorker' in navigator) {
        // Menggunakan jalur absolut atau menyesuaikan root project Anda
        navigator.serviceWorker.register('./firebase-messaging-sw.js').then((registration) => {
          console.log('Service Worker berhasil:', registration.scope);
        }).catch((err) => {
          console.log('Pendaftaran Service Worker dilewati:', err.message);
        });
      }
    } catch (e) {
      console.log('Messaging error:', e);
    }
