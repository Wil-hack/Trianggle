// ============================================================================
// TRIHIVE - FULL SCRIPT (src/main.ts)
// Lengkap dengan WebRTC Call, Background Notifications, & Chat Mobile Optimization
// ============================================================================

import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  onChildChanged,
  set,
  get,
  update,
  remove,
  onValue,
  onDisconnect,
  DataSnapshot,
  query,
  limitToLast
} from "firebase/database";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

// 1. Konfigurasi Firebase TriHive
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyBfAvdE0PZMvytkSaofbFAgk0749E-b_pI",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "trihive-857cd.firebaseapp.com",
  databaseURL: (import.meta as any).env?.VITE_FIREBASE_DATABASE_URL || "https://trihive-857cd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "trihive-857cd",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "trihive-857cd.firebasestorage.app",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "434709340496",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:434709340496:web:3e1206dc10679ddc680c55"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const VAPID_PUBLIC_KEY = "BBqfPddFnX-9yjuEpZ8u0DArJ_shiQ2tK6wTux8yVOQLvIbiCt3XNN6xBs-7RnD8_pTHQExSLV7mL0MVg5uOPFA";

// Toast notifikasi in-app
export function showToast(message: string, duration = 3200) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="toast-dot"></span><span>${message}</span>`;
  toast.classList.add('active');
  clearTimeout((window as any).__toastTimeout);
  (window as any).__toastTimeout = setTimeout(() => {
    toast?.classList.remove('active');
  }, duration);
}

window.alert = function (msg: any) {
  showToast(String(msg));
};

// -------------------------------------------------------------
// SISTEM NOTIFIKASI (SAAT DI-MINIMIZE ATAU LATAR BELAKANG)
// -------------------------------------------------------------

export async function showSystemNotification(title: string, options: NotificationOptions = {}) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const defaultOptions: any = {
    icon: '/logo.png',
    badge: '/logo.png',
    tag: options.tag || 'trihive',
    renotify: true,
    ...options
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, defaultOptions);
        return;
      }
    }
  } catch (err) {
    console.warn("SW notification note:", err);
  }

  try {
    const notif = new Notification(title, defaultOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (err) {
    console.warn("Desktop notification note:", err);
  }
}

export function closeSystemNotification(tag: string) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.getNotifications({ tag }).then(notifs => {
        notifs.forEach(n => n.close());
      }).catch(() => {});
    }).catch(() => {});
  }
}

(window as any).enablePushNotifications = async function () {
  if (!('Notification' in window)) {
    showToast("Peramban ini tidak mendukung sistem notifikasi.");
    return;
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast("Notifikasi aktif! Panggilan & pesan akan muncul saat di-minimize.");
      updateNotificationButtonUI();
      registerFCMToken();
    } else if (perm === 'denied') {
      showToast("Izin notifikasi ditolak di peramban.");
    }
  } catch (err) {
    console.error("Izin notifikasi gagal:", err);
    showToast("Gagal meminta izin notifikasi.");
  }
};

function updateNotificationButtonUI() {
  const btn = document.getElementById('enable-notifications-btn');
  if (!btn) return;
  if (('Notification' in window) && Notification.permission === 'granted') {
    btn.style.color = '#10b981';
    btn.setAttribute('title', 'Notifikasi Aktif');
  } else {
    btn.style.color = '#94a3b8';
    btn.setAttribute('title', 'Aktifkan Notifikasi');
  }
}

async function registerFCMToken() {
  try {
    const supported = await isSupported();
    if (!supported || !currentUser) return;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY
    });

    if (token) {
      await update(ref(db, `users/${currentUser}`), {
        fcmToken: token,
        lastTokenUpdate: Date.now()
      });
    }
  } catch (err) {
    console.warn("Registrasi token FCM dilewati:", err);
  }
}

// -------------------------------------------------------------
// SOUND EFFECTS & AUDIO AUTOPLAY UNLOCK
// -------------------------------------------------------------

let isAudioUnlocked = false;

function unlockAudio() {
  if (isAudioUnlocked) return;
  const notif = document.getElementById('notif-audio') as HTMLAudioElement | null;
  const ring = document.getElementById('ring-audio') as HTMLAudioElement | null;
  const remote = document.getElementById('remote-audio') as HTMLAudioElement | null;

  [notif, ring, remote].forEach(a => {
    if (a) {
      const p = a.play();
      if (p !== undefined) {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
        }).catch(() => {});
      }
    }
  });
  isAudioUnlocked = true;
}

window.addEventListener('click', unlockAudio, { once: true });
window.addEventListener('touchstart', unlockAudio, { once: true });

function playNotificationSound() {
  const a = document.getElementById('notif-audio') as HTMLAudioElement | null;
  if (a) {
    a.currentTime = 0;
    a.play().catch(e => console.log("Notif sound block:", e));
  }
}

function playRingingSound() {
  const a = document.getElementById('ring-audio') as HTMLAudioElement | null;
  if (a) {
    a.currentTime = 0;
    a.play().catch(e => console.log("Ring sound block:", e));
  }
}

function stopRingingSound() {
  const a = document.getElementById('ring-audio') as HTMLAudioElement | null;
  if (a) {
    a.pause();
    a.currentTime = 0;
  }
}

// -------------------------------------------------------------
// APPLICATION STATE
// -------------------------------------------------------------

interface Contact {
  username: string;
  name: string;
  avatar?: string;
  row?: number;
  col?: number;
  unreadCount?: number;
}

let currentUser: string | null = localStorage.getItem('trihive_user') || null;
let currentDisplayName: string = localStorage.getItem('trihive_name') || 'Pengguna';
let currentAvatarUrl: string = localStorage.getItem('trihive_avatar') || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

let contacts: Contact[] = [];
let unreadCounts: Record<string, number> = {};
let activeContact: Contact | null = null;
let replyingTo: { text: string; sender: string } | null = null;

let isRecording = false;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let typingTimeout: any = null;
let activeStatusListener: (() => void) | null = null;
let activeProfileStatusListener: (() => void) | null = null;
let activeListeners: Record<string, boolean> = {};

// WebRTC State
let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let isVideoCall = false;
let currentFacingMode: 'user' | 'environment' = 'user';
let isIncomingListening = false;
let targetUser: string | null = null;
let callTimeoutTimer: any = null;
let pendingIceCandidates: RTCIceCandidateInit[] = [];

// Multi-server STUN Configuration
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ],
  iceCandidatePoolSize: 10
};

let tempUploadAvatar = "";

// -------------------------------------------------------------
// GRID RENDERING & PAN/ZOOM
// -------------------------------------------------------------

const ROWS = 12;
const COLS = 12;
let scale = 1;
let pointX = 0;
let pointY = 0;
let startX = 0;
let startY = 0;
let isDragging = false;
let initialDistance = 0;
let initialScale = 1;

export function buildGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  grid.innerHTML = '';

  let contactIdx = 0;

  for (let r = 0; r < ROWS; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'grid-row';

    for (let c = 0; c < COLS; c++) {
      const tile = document.createElement('div');
      const isUpright = (r + c) % 2 === 0;
      tile.className = `tile ${isUpright ? 'tile-upright' : 'tile-inverted'}`;
      tile.style.setProperty('--col-index', `${c}`);

      const inner = document.createElement('div');
      inner.className = 'tile-inner';

      if (contactIdx < contacts.length) {
        const contact = contacts[contactIdx];
        const unread = unreadCounts[contact.username] || 0;

        const photoWrapper = document.createElement('div');
        photoWrapper.className = 'tile-photo-wrapper';

        const img = document.createElement('img');
        img.className = 'tile-photo';
        img.src = contact.avatar || currentAvatarUrl;
        img.alt = contact.name;
        img.loading = "lazy";
        img.onerror = () => {
          img.src = '/pwa-192x192.png';
        };

        const overlay = document.createElement('div');
        overlay.className = 'tile-photo-overlay';

        const badge = document.createElement('div');
        badge.className = 'unread-badge';
        badge.innerText = unread > 99 ? '99+' : `${unread}`;
        if (unread > 0) {
          badge.style.display = 'block';
        }

        photoWrapper.appendChild(img);
        photoWrapper.appendChild(overlay);
        photoWrapper.appendChild(badge);
        inner.appendChild(photoWrapper);

        tile.onclick = () => {
          (window as any).openProfile(contact);
        };

        contactIdx++;
      } else {
        const bg = document.createElement('div');
        bg.className = 'tile-bg';
        inner.appendChild(bg);

        tile.onclick = () => {
          if (currentUser) {
            (window as any).openAddContactModal();
          } else {
            showToast("Silakan login terlebih dahulu.");
          }
        };
      }

      tile.appendChild(inner);
      rowEl.appendChild(tile);
    }
    grid.appendChild(rowEl);
  }
}

function initPanZoom() {
  const viewport = document.getElementById('viewport');
  const canvas = document.getElementById('canvas');
  if (!viewport || !canvas) return;

  function setTransform() {
    canvas!.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
  }

  pointX = (window.innerWidth - 1200) / 2;
  pointY = (window.innerHeight - 800) / 2;
  setTransform();

  viewport.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.tile')) return;
    isDragging = true;
    startX = e.clientX - pointX;
    startY = e.clientY - pointY;
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    pointX = e.clientX - startX;
    pointY = e.clientY - startY;
    setTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  viewport.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    const xs = (e.clientX - pointX) / scale;
    const ys = (e.clientY - pointY) / scale;
    const delta = -e.deltaY;
    if (delta > 0) {
      scale = Math.min(scale * 1.1, 2.5);
    } else {
      scale = Math.max(scale / 1.1, 0.4);
    }
    pointX = e.clientX - xs * scale;
    pointY = e.clientY - ys * scale;
    setTransform();
  }, { passive: false });

  viewport.addEventListener('touchstart', (e: TouchEvent) => {
    if ((e.target as HTMLElement).closest('.tile')) return;
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - pointX;
      startY = e.touches[0].clientY - pointY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      initialDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialScale = scale;
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e: TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      pointX = e.touches[0].clientX - startX;
      pointY = e.touches[0].clientY - startY;
      setTransform();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (initialDistance > 0) {
        const factor = dist / initialDistance;
        scale = Math.min(Math.max(initialScale * factor, 0.4), 2.5);
        setTransform();
      }
    }
  }, { passive: true });

  viewport.addEventListener('touchend', () => {
    isDragging = false;
  });
}

// -------------------------------------------------------------
// USER AUTHENTICATION & KONTAK
// -------------------------------------------------------------

(window as any).switchTab = function (tab: 'login' | 'register') {
  document.getElementById('tab-login')?.classList.toggle('active', tab === 'login');
  document.getElementById('tab-register')?.classList.toggle('active', tab === 'register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  if (formLogin) formLogin.style.display = tab === 'login' ? 'block' : 'none';
  if (formRegister) formRegister.style.display = tab === 'register' ? 'block' : 'none';
};

(window as any).submitLogin = function () {
  unlockAudio();
  const uInput = document.getElementById('login-username') as HTMLInputElement;
  const pInput = document.getElementById('login-password') as HTMLInputElement;
  const u = uInput?.value.trim().toLowerCase();
  const p = pInput?.value.trim();
  if (!u || !p) {
    showToast("Isi username & password!");
    return;
  }
  get(ref(db, `users/${u}`)).then((snap: DataSnapshot) => {
    if (snap.exists() && snap.val().password === p) {
      currentUser = u;
      currentDisplayName = snap.val().displayName || u;
      currentAvatarUrl = snap.val().avatar || currentAvatarUrl;
      localStorage.setItem('trihive_user', currentUser);
      localStorage.setItem('trihive_name', currentDisplayName);
      localStorage.setItem('trihive_avatar', currentAvatarUrl);
      setUserLoggedIn();
      loadUserContacts();
      setupIncomingCallsListener();
      updateNotificationButtonUI();
      showToast(`Selamat datang kembali, ${currentDisplayName}!`);
    } else {
      showToast("Login gagal! Periksa username & password.");
    }
  }).catch((err) => {
    console.error(err);
    showToast("Terjadi kesalahan saat login.");
  });
};

(window as any).submitRegister = function () {
  unlockAudio();
  const uInput = document.getElementById('reg-username') as HTMLInputElement;
  const fInput = document.getElementById('reg-fullname') as HTMLInputElement;
  const pInput = document.getElementById('reg-password') as HTMLInputElement;
  const u = uInput?.value.trim().toLowerCase();
  const f = fInput?.value.trim() || u;
  const p = pInput?.value.trim();
  if (!u || !p) {
    showToast("Isi data dengan lengkap!");
    return;
  }
  get(ref(db, `users/${u}`)).then((snap: DataSnapshot) => {
    if (snap.exists()) {
      showToast("Username sudah dipakai, pilih username lain.");
      return;
    }
    const avatar = tempUploadAvatar || currentAvatarUrl;
    set(ref(db, `users/${u}`), { username: u, displayName: f, password: p, avatar }).then(() => {
      currentUser = u;
      currentDisplayName = f;
      currentAvatarUrl = avatar;
      localStorage.setItem('trihive_user', currentUser);
      localStorage.setItem('trihive_name', currentDisplayName);
      localStorage.setItem('trihive_avatar', currentAvatarUrl);
      setUserLoggedIn();
      loadUserContacts();
      setupIncomingCallsListener();
      updateNotificationButtonUI();
      showToast("Pendaftaran berhasil! Selamat datang di TriHive.");
    });
  }).catch((err) => {
    console.error(err);
    showToast("Terjadi kesalahan saat pendaftaran.");
  });
};

function setUserLoggedIn() {
  document.getElementById('login-modal')?.classList.remove('active');
  const userPill = document.getElementById('user-pill');
  if (userPill) userPill.style.display = 'flex';
  const nameElem = document.getElementById('current-user-name');
  if (nameElem) nameElem.innerText = currentDisplayName;
  const avatarElem = document.getElementById('current-user-avatar') as HTMLImageElement | null;
  if (avatarElem) avatarElem.src = currentAvatarUrl;

  if (!currentUser) return;
  const statusRef = ref(db, `status/${currentUser}`);
  onValue(ref(db, '.info/connected'), (snap: DataSnapshot) => {
    if (snap.val() === true) {
      onDisconnect(statusRef).set({ isOnline: false, lastSeen: Date.now() });
      set(statusRef, { isOnline: true, lastSeen: Date.now() });
    }
  });
  setInterval(() => {
    if (currentUser) {
      set(ref(db, `status/${currentUser}/lastSeen`), Date.now());
    }
  }, 15000);
}

function loadUserContacts() {
  if (!currentUser) return;
  onChildAdded(ref(db, `user_contacts/${currentUser}`), (snap: DataSnapshot) => {
    const cUser = snap.key;
    if (!cUser) return;
    get(ref(db, `users/${cUser}`)).then((cSnap: DataSnapshot) => {
      if (cSnap.exists()) {
        const data = cSnap.val();
        if (!contacts.find(c => c.username === cUser)) {
          contacts.push({
            username: data.username,
            name: data.displayName || data.username,
            avatar: data.avatar
          });
          buildGrid();
          listenIncomingMessages(cUser);
        }
      }
    });
  });
}

function listenIncomingMessages(cUser: string) {
  if (!currentUser) return;
  if (activeListeners[cUser]) return;
  activeListeners[cUser] = true;
  const roomId = [currentUser, cUser].sort().join('_');
  let isInit = true;
  get(ref(db, `chats/${roomId}`)).then(() => {
    isInit = false;
  });
  onChildAdded(ref(db, `chats/${roomId}`), (snap: DataSnapshot) => {
    const data = snap.val();
    if (!data) return;
    if (data.sender === cUser) {
      const chatModal = document.getElementById('chat-modal');
      const isOpen = activeContact && activeContact.username === cUser && chatModal?.classList.contains('active');
      const isMinimizedOrHidden = document.hidden || !isOpen;

      if (isOpen && !document.hidden) {
        update(ref(db, `chats/${roomId}/${snap.key}`), { unread: false });
      } else if (data.unread !== false) {
        if (!isInit) playNotificationSound();
        unreadCounts[cUser] = (unreadCounts[cUser] || 0) + 1;
        buildGrid();

        if (!isInit && isMinimizedOrHidden) {
          const contactObj = contacts.find(c => c.username === cUser);
          const senderName = contactObj?.name || cUser;
          let bodyText = "Pesan baru";
          if (data.type === 'voice') bodyText = "🎤 Pesan Suara";
          else if (data.type === 'image') bodyText = "📷 Foto";
          else if (data.text) bodyText = data.text;

          showSystemNotification(`Pesan dari ${senderName}`, {
            body: bodyText,
            tag: `msg-${cUser}`,
            data: { username: cUser }
          });
        }
      }
    }
  });

  onChildChanged(ref(db, `chats/${roomId}`), (snap: DataSnapshot) => {
    const data = snap.val();
    if (!data) return;
    if (data.sender === cUser && data.unread === false) {
      if (unreadCounts[cUser] > 0) {
        unreadCounts[cUser]--;
        buildGrid();
      }
    }
  });
}

// -------------------------------------------------------------
// WEBRTC SIGNALING & CANDIDATE QUEUING (FIX TELEPON PUTUS)
// -------------------------------------------------------------

async function handleIncomingIceCandidate(cand: RTCIceCandidateInit) {
  if (!cand || !cand.candidate) return;
  if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
    } catch (e) {
      console.warn("Gagal menambahkan ICE candidate langsung:", e);
    }
  } else {
    pendingIceCandidates.push(cand);
  }
}

async function flushPendingIceCandidates() {
  if (!peerConnection || !peerConnection.remoteDescription) return;
  const queue = [...pendingIceCandidates];
  pendingIceCandidates = [];
  for (const cand of queue) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
    } catch (e) {
      console.warn("Gagal flush ICE candidate:", e);
    }
  }
}

function setupIncomingCallsListener() {
  if (!currentUser || isIncomingListening) return;
  isIncomingListening = true;

  onValue(ref(db, `calls/${currentUser}`), async (snap: DataSnapshot) => {
    const data = snap.val();
    const incModal = document.getElementById('incoming-call-modal');
    const callModal = document.getElementById('call-modal');
    const callStatus = document.getElementById('call-status-text');

    if (data && data.status === 'calling') {
      targetUser = data.caller;
      isVideoCall = !!data.isVideo;
      playRingingSound();
      const incName = document.getElementById('incoming-name');
      const incAvatar = document.getElementById('incoming-avatar') as HTMLImageElement | null;
      const incType = document.getElementById('incoming-call-type');
      const callerName = data.callerName || targetUser;
      if (incName) incName.innerText = callerName;
      if (incAvatar) incAvatar.src = data.callerAvatar || currentAvatarUrl;
      if (incType) incType.innerText = isVideoCall ? "Video Call Masuk..." : "Voice Call Masuk...";
      incModal?.classList.add('active');

      showSystemNotification(
        isVideoCall ? "📹 Video Call Masuk" : "📞 Panggilan Suara Masuk",
        {
          body: `${callerName} sedang memanggil Anda...`,
          tag: 'incoming-call',
          requireInteraction: true
        }
      );
    } else if (data && data.status === 'connected') {
      stopRingingSound();
      closeSystemNotification('incoming-call');
      if (callStatus) callStatus.innerText = "Terhubung";
    } else if (data && data.status === 'rejected') {
      stopRingingSound();
      closeSystemNotification('incoming-call');
      cleanupWebRTC();
      showToast("Panggilan ditolak.");
      incModal?.classList.remove('active');
      callModal?.classList.remove('active');
    } else if (!data) {
      stopRingingSound();
      closeSystemNotification('incoming-call');
      cleanupWebRTC();
      incModal?.classList.remove('active');
      callModal?.classList.remove('active');
    }
  });

  onValue(ref(db, `webrtc_signals/${currentUser}/answer`), async (snap: DataSnapshot) => {
    const ans = snap.val();
    if (ans && peerConnection && peerConnection.signalingState === "have-local-offer") {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(ans));
        stopRingingSound();
        if (callTimeoutTimer) clearTimeout(callTimeoutTimer);
        const callStatus = document.getElementById('call-status-text');
        if (callStatus) callStatus.innerText = "Terhubung";
        await flushPendingIceCandidates();
      } catch (err) {
        console.error("Gagal setRemoteDescription answer:", err);
      }
    }
  });

  onChildAdded(ref(db, `webrtc_signals/${currentUser}/candidates`), async (snap: DataSnapshot) => {
    const cand = snap.val();
    if (cand) {
      await handleIncomingIceCandidate(cand);
    }
  });
}

async function initMediaStream(video: boolean): Promise<MediaStream> {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  let stream: MediaStream | null = null;

  if (video) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
    } catch (e) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });
      } catch (err2) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        video = false;
        isVideoCall = false;
        showToast("Kamera tidak dapat diakses, beralih ke suara.");
      }
    }
  } else {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  }

  localStream = stream;
  const localVid = document.getElementById('local-video') as HTMLVideoElement | null;
  const videoBox = document.getElementById('video-box');
  const btnFlip = document.getElementById('btn-flip');

  if (localVid && video && stream.getVideoTracks().length > 0) {
    localVid.srcObject = stream;
    if (videoBox) videoBox.style.display = 'block';
    if (btnFlip) btnFlip.style.display = 'flex';
  } else {
    if (videoBox) videoBox.style.display = 'none';
    if (btnFlip) btnFlip.style.display = 'none';
  }

  return stream;
}

function createPeerConnection(targetUsername: string) {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  pendingIceCandidates = [];
  peerConnection = new RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection!.addTrack(track, localStream!);
    });
  }

  peerConnection.ontrack = (event) => {
    const remoteStream = event.streams[0];
    const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement | null;
    const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement | null;
    const videoBox = document.getElementById('video-box');

    if (isVideoCall && remoteVideo) {
      remoteVideo.srcObject = remoteStream;
      if (videoBox) videoBox.style.display = 'block';
      remoteVideo.play().catch(e => console.log("Remote video autoplay blocked:", e));
    }

    if (remoteAudio) {
      remoteAudio.srcObject = remoteStream;
      remoteAudio.play().catch(e => {
        const unmuteBtn = document.querySelector('.btn-unmute-audio') as HTMLElement | null;
        if (unmuteBtn) unmuteBtn.style.display = 'inline-block';
      });
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentUser && targetUsername) {
      push(ref(db, `webrtc_signals/${targetUsername}/candidates`), event.candidate.toJSON());
    }
  };

  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection?.connectionState;
    const callStatus = document.getElementById('call-status-text');
    if (state === 'connected') {
      if (callStatus) callStatus.innerText = "Terhubung";
      stopRingingSound();
    } else if (state === 'disconnected' || state === 'failed') {
      showToast("Koneksi panggilan terputus.");
      (window as any).endCall();
    }
  };
}

(window as any).forcePlayAudio = function () {
  const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement | null;
  const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement | null;
  if (remoteAudio) remoteAudio.play().catch(() => {});
  if (remoteVideo) remoteVideo.play().catch(() => {});
  showToast("Suara diaktifkan.");
};

(window as any).switchCamera = async function () {
  if (!isVideoCall || !localStream) return;
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode },
      audio: false
    });
    const newVideoTrack = newStream.getVideoTracks()[0];
    const sender = peerConnection?.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(newVideoTrack);
    const oldVideoTrack = localStream.getVideoTracks()[0];
    if (oldVideoTrack) oldVideoTrack.stop();
    localStream.removeTrack(oldVideoTrack);
    localStream.addTrack(newVideoTrack);
    const localVid = document.getElementById('local-video') as HTMLVideoElement | null;
    if (localVid) localVid.srcObject = localStream;
    showToast(`Beralih ke kamera ${currentFacingMode === 'user' ? 'depan' : 'belakang'}`);
  } catch (e) {
    showToast("Gagal beralih kamera.");
  }
};

(window as any).startCall = async function (video: boolean) {
  if (!activeContact || !currentUser) return;
  unlockAudio();
  isVideoCall = video;
  targetUser = activeContact.username;

  try {
    await initMediaStream(video);
    createPeerConnection(targetUser);

    await remove(ref(db, `webrtc_signals/${targetUser}`));
    await remove(ref(db, `webrtc_signals/${currentUser}`));

    const offer = await peerConnection!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: video
    });
    await peerConnection!.setLocalDescription(offer);

    await set(ref(db, `webrtc_signals/${targetUser}/offer`), {
      type: offer.type,
      sdp: offer.sdp
    });

    await set(ref(db, `calls/${targetUser}`), {
      caller: currentUser,
      callerName: currentDisplayName,
      callerAvatar: currentAvatarUrl,
      isVideo: video,
      status: 'calling',
      timestamp: Date.now()
    });

    playRingingSound();
    const callName = document.getElementById('call-name');
    const callAvatar = document.getElementById('call-avatar') as HTMLImageElement | null;
    const callStatus = document.getElementById('call-status-text');
    if (callName) callName.innerText = activeContact.name;
    if (callAvatar) callAvatar.src = activeContact.avatar || currentAvatarUrl;
    if (callStatus) callStatus.innerText = "Memanggil...";
    document.getElementById('call-modal')?.classList.add('active');

    if (callTimeoutTimer) clearTimeout(callTimeoutTimer);
    callTimeoutTimer = setTimeout(() => {
      if (peerConnection && peerConnection.iceConnectionState !== 'connected') {
        showToast(`Tidak ada jawaban dari ${activeContact?.name || 'kontak'}.`);
        (window as any).endCall();
      }
    }, 45000);
  } catch (err) {
    console.error("Gagal memulai panggilan WebRTC:", err);
    showToast("Gagal memulai panggilan.");
    cleanupWebRTC();
  }
};

(window as any).acceptCall = async function () {
  stopRingingSound();
  closeSystemNotification('incoming-call');
  document.getElementById('incoming-call-modal')?.classList.remove('active');

  if (!targetUser || !currentUser) return;

  try {
    await initMediaStream(isVideoCall);
  } catch (e) {
    (window as any).rejectCall();
    return;
  }

  createPeerConnection(targetUser);
  if (!peerConnection) return;

  try {
    const offerSnap = await get(ref(db, `webrtc_signals/${currentUser}/offer`));
    if (offerSnap.exists()) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offerSnap.val()));
      await flushPendingIceCandidates();

      const candSnap = await get(ref(db, `webrtc_signals/${currentUser}/candidates`));
      if (candSnap.exists()) {
        const val = candSnap.val();
        for (const key in val) {
          if (val[key]) {
            await handleIncomingIceCandidate(val[key]);
          }
        }
        await flushPendingIceCandidates();
      }

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await set(ref(db, `webrtc_signals/${targetUser}/answer`), {
        type: answer.type,
        sdp: answer.sdp
      });
    }

    await update(ref(db, `calls/${currentUser}`), { status: 'connected' });
    await update(ref(db, `calls/${targetUser}`), { status: 'connected' });

    const callName = document.getElementById('call-name');
    const callAvatar = document.getElementById('call-avatar') as HTMLImageElement | null;
    const callStatus = document.getElementById('call-status-text');
    if (callName) callName.innerText = targetUser;
    if (callAvatar) callAvatar.src = currentAvatarUrl;
    if (callStatus) callStatus.innerText = "Terhubung";
    document.getElementById('call-modal')?.classList.add('active');
  } catch (err) {
    console.error("Gagal menerima panggilan WebRTC:", err);
    showToast("Gagal menghubungkan panggilan.");
    (window as any).endCall();
  }
};

(window as any).rejectCall = function () {
  stopRingingSound();
  closeSystemNotification('incoming-call');
  if (targetUser) {
    update(ref(db, `calls/${targetUser}`), { status: 'rejected' }).catch(() => {});
    remove(ref(db, `webrtc_signals/${targetUser}`)).catch(() => {});
  }
  if (currentUser) {
    remove(ref(db, `calls/${currentUser}`)).catch(() => {});
    remove(ref(db, `webrtc_signals/${currentUser}`)).catch(() => {});
  }
  cleanupWebRTC();
  document.getElementById('incoming-call-modal')?.classList.remove('active');
  showToast("Panggilan ditolak.");
};

function cleanupWebRTC() {
  closeSystemNotification('incoming-call');
  if (callTimeoutTimer) {
    clearTimeout(callTimeoutTimer);
    callTimeoutTimer = null;
  }
  pendingIceCandidates = [];
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement | null;
  const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement | null;
  const localVid = document.getElementById('local-video') as HTMLVideoElement | null;
  if (remoteAudio) remoteAudio.srcObject = null;
  if (remoteVideo) remoteVideo.srcObject = null;
  if (localVid) localVid.srcObject = null;
  const videoBox = document.getElementById('video-box');
  const btnFlip = document.getElementById('btn-flip');
  if (videoBox) videoBox.style.display = 'none';
  if (btnFlip) btnFlip.style.display = 'none';
  targetUser = null;
}

(window as any).endCall = function () {
  stopRingingSound();
  closeSystemNotification('incoming-call');
  if (targetUser) {
    remove(ref(db, `calls/${targetUser}`)).catch(() => {});
    remove(ref(db, `webrtc_signals/${targetUser}`)).catch(() => {});
  }
  if (activeContact) {
    remove(ref(db, `calls/${activeContact.username}`)).catch(() => {});
    remove(ref(db, `webrtc_signals/${activeContact.username}`)).catch(() => {});
  }
  if (currentUser) {
    remove(ref(db, `calls/${currentUser}`)).catch(() => {});
    remove(ref(db, `webrtc_signals/${currentUser}`)).catch(() => {});
  }
  cleanupWebRTC();
  document.getElementById('call-modal')?.classList.remove('active');
  document.getElementById('incoming-call-modal')?.classList.remove('active');
};

// -------------------------------------------------------------
// VOICE NOTES & GAMBAR
// -------------------------------------------------------------

(window as any).toggleVoiceRecord = async function () {
  const micBtn = document.getElementById('btn-mic');
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const reader = new FileReader();
        reader.readAsDataURL(new Blob(audioChunks, { type: 'audio/webm' }));
        reader.onloadend = () => {
          sendVoiceMessage(reader.result as string);
        };
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      isRecording = true;
      if (micBtn) micBtn.style.color = '#ef4444';
      showToast("Sedang merekam suara...");
    } catch (e) {
      showToast("Mikrofon gagal diakses. Pastikan izin mikrofon diberikan.");
    }
  } else {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    isRecording = false;
    if (micBtn) micBtn.style.color = '#dfb76c';
  }
};

function sendVoiceMessage(base64Audio: string) {
  if (!activeContact || !currentUser) return;
  const roomId = [currentUser, activeContact.username].sort().join('_');
  push(ref(db, `chats/${roomId}`), {
    sender: currentUser,
    type: 'voice',
    audio: base64Audio,
    unread: true,
    timestamp: Date.now(),
    replyTo: replyingTo ? { text: replyingTo.text || 'Pesan Suara', sender: replyingTo.sender } : null
  });
  (window as any).cancelReply();
}

(window as any).sendImageMessage = function (e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file || !activeContact || !currentUser) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    if (!currentUser || !activeContact) return;
    const roomId = [currentUser, activeContact.username].sort().join('_');
    push(ref(db, `chats/${roomId}`), {
      sender: currentUser,
      type: 'image',
      image: evt.target?.result,
      unread: true,
      timestamp: Date.now(),
      replyTo: replyingTo ? { text: replyingTo.text || 'Gambar', sender: replyingTo.sender } : null
    });
    (window as any).cancelReply();
  };
  reader.readAsDataURL(file);
};

// -------------------------------------------------------------
// PROFIL & KONTAK
// -------------------------------------------------------------

(window as any).openEditProfileModal = function () {
  const userElem = document.getElementById('edit-username-id');
  const nameInput = document.getElementById('edit-fullname') as HTMLInputElement | null;
  const preview = document.getElementById('edit-upload-preview') as HTMLImageElement | null;
  if (userElem) userElem.innerText = `@${currentUser}`;
  if (nameInput) nameInput.value = currentDisplayName;
  if (preview) {
    preview.src = currentAvatarUrl;
    preview.style.display = 'block';
  }
  document.body.classList.add('modal-open');
  document.getElementById('edit-profile-modal')?.classList.add('active');
};

(window as any).saveProfileChanges = function () {
  if (!currentUser) return;
  const nameInput = document.getElementById('edit-fullname') as HTMLInputElement | null;
  const name = nameInput?.value.trim();
  const avatar = tempUploadAvatar || currentAvatarUrl;
  if (!name) return;
  update(ref(db, `users/${currentUser}`), { displayName: name, avatar }).then(() => {
    currentDisplayName = name;
    currentAvatarUrl = avatar;
    localStorage.setItem('trihive_name', currentDisplayName);
    localStorage.setItem('trihive_avatar', currentAvatarUrl);
    const currName = document.getElementById('current-user-name');
    const currAvatar = document.getElementById('current-user-avatar') as HTMLImageElement | null;
    if (currName) currName.innerText = currentDisplayName;
    if (currAvatar) currAvatar.src = currentAvatarUrl;
    tempUploadAvatar = "";
    (window as any).closeModals();
    showToast("Profil berhasil diperbarui!");
  });
};

(window as any).openAddContactModal = function () {
  if (currentUser) {
    document.body.classList.add('modal-open');
    document.getElementById('add-contact-modal')?.classList.add('active');
  }
};

(window as any).submitAddContact = function () {
  if (!currentUser) return;
  const input = document.getElementById('add-contact-username') as HTMLInputElement | null;
  const u = input?.value.trim().toLowerCase();
  if (!u || u === currentUser) {
    showToast("Username tidak valid.");
    return;
  }
  get(ref(db, `users/${u}`)).then((snap: DataSnapshot) => {
    if (!snap.exists()) {
      showToast("Username tidak ditemukan.");
      return;
    }
    set(ref(db, `user_contacts/${currentUser}/${u}`), true);
    set(ref(db, `user_contacts/${u}/${currentUser}`), true);
    if (input) input.value = '';
    (window as any).closeModals();
    showToast("Kontak berhasil ditambahkan!");
  }).catch((err) => {
    console.error(err);
    showToast("Gagal menambahkan kontak.");
  });
};

(window as any).logout = function () {
  if (currentUser) {
    set(ref(db, `status/${currentUser}`), { isOnline: false, lastSeen: Date.now() });
  }
  localStorage.clear();
  currentUser = null;
  contacts = [];
  unreadCounts = {};
  activeListeners = {};
  isIncomingListening = false;
  buildGrid();
  const userPill = document.getElementById('user-pill');
  if (userPill) userPill.style.display = 'none';
  (window as any).closeModals();
  document.getElementById('login-modal')?.classList.add('active');
  showToast("Anda telah keluar akun.");
};

(window as any).openProfile = function (person: Contact) {
  activeContact = person;
  const prevName = document.getElementById('preview-name');
  const prevUser = document.getElementById('preview-username-id');
  const prevAvatar = document.getElementById('preview-avatar') as HTMLImageElement | null;
  const statusElem = document.getElementById('preview-status');
  if (prevName) prevName.innerText = person.name;
  if (prevUser) prevUser.innerText = `@${person.username}`;
  if (prevAvatar) prevAvatar.src = person.avatar || currentAvatarUrl;

  if (activeProfileStatusListener) activeProfileStatusListener();
  activeProfileStatusListener = onValue(ref(db, `status/${person.username}`), (snap: DataSnapshot) => {
    const d = snap.val();
    if (statusElem) {
      statusElem.innerText = (d && d.isOnline) ? "● Online" : "● Offline";
      statusElem.style.color = (d && d.isOnline) ? "#10b981" : "#94a3b8";
    }
  });
  document.body.classList.add('modal-open');
  document.getElementById('profile-modal')?.classList.add('active');
};

// -------------------------------------------------------------
// CHAT & LOAD MESSAGES (OPTIMALISASI KECEPATAN HP)
// -------------------------------------------------------------

let activeChatAddedListener: (() => void) | null = null;
let activeChatChangedListener: (() => void) | null = null;
let currentChatRoomId: string | null = null;
let unreadDebounceTimer: any = null;
const pendingUnreadKeys: string[] = [];

(window as any).openChat = function () {
  if (!activeContact || !currentUser) return;

  document.querySelectorAll('.modal-backdrop').forEach(m => {
    if (m.id !== 'login-modal' && m.id !== 'chat-modal') m.classList.remove('active');
  });

  document.body.classList.add('modal-open');
  const chatModal = document.getElementById('chat-modal');
  if (chatModal) chatModal.classList.add('active');

  const chatName = document.getElementById('chat-name');
  const chatAvatar = document.getElementById('chat-avatar') as HTMLImageElement | null;
  if (chatName) chatName.innerText = activeContact.name;
  if (chatAvatar) chatAvatar.src = activeContact.avatar || currentAvatarUrl;

  unreadCounts[activeContact.username] = 0;
  buildGrid();

  const statusElem = document.getElementById('chat-status');
  if (activeStatusListener) activeStatusListener();
  activeStatusListener = onValue(ref(db, `status/${activeContact.username}`), (snap: DataSnapshot) => {
    const d = snap.val();
    if (statusElem) {
      if (d && d.isTyping) {
        statusElem.innerText = "Sedang mengetik...";
        statusElem.style.color = "#dfb76c";
      } else if (d && d.isOnline) {
        statusElem.innerText = "Online";
        statusElem.style.color = "#10b981";
      } else {
        statusElem.innerText = "Offline";
        statusElem.style.color = "#94a3b8";
      }
    }
  });

  loadMessages();
};

(window as any).notifyTyping = function () {
  if (!currentUser || !activeContact) return;
  const statusRef = ref(db, `status/${currentUser}`);
  update(statusRef, { isOnline: true, isTyping: true });
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    update(statusRef, { isTyping: false });
  }, 2000);
};

function loadMessages() {
  if (!currentUser || !activeContact) return;
  const chatBody = document.getElementById('chat-body');
  if (!chatBody) return;

  const roomId = [currentUser, activeContact.username].sort().join('_');

  // Lepaskan listener lama jika berganti room obrolan
  if (activeChatAddedListener && currentChatRoomId !== roomId) {
    activeChatAddedListener();
    activeChatAddedListener = null;
  }
  if (activeChatChangedListener && currentChatRoomId !== roomId) {
    activeChatChangedListener();
    activeChatChangedListener = null;
  }

  if (currentChatRoomId !== roomId) {
    chatBody.innerHTML = '';
    currentChatRoomId = roomId;
  } else if (activeChatAddedListener) {
    chatBody.scrollTop = chatBody.scrollHeight;
    return;
  }

  // Gunakan limit 50 pesan terakhir agar HP tidak lag
  const chatQuery = query(ref(db, `chats/${roomId}`), limitToLast(50));

  activeChatAddedListener = onChildAdded(chatQuery, (snap: DataSnapshot) => {
    const data = snap.val();
    const msgKey = snap.key;
    if (!data || (data.type === 'text' && (!data.text || data.text === 'undefined'))) return;
    const isMe = data.sender === currentUser;

    if (!isMe && data.unread !== false && msgKey) {
      pendingUnreadKeys.push(msgKey);
      if (unreadDebounceTimer) clearTimeout(unreadDebounceTimer);
      unreadDebounceTimer = setTimeout(() => {
        const keys = [...pendingUnreadKeys];
        pendingUnreadKeys.length = 0;
        keys.forEach(k => {
          update(ref(db, `chats/${roomId}/${k}`), { unread: false }).catch(() => {});
        });
      }, 500);
    }

    renderChatMessage(msgKey || '', data, isMe);
    chatBody.scrollTop = chatBody.scrollHeight;
  });

  activeChatChangedListener = onChildChanged(ref(db, `chats/${roomId}`), (snap: DataSnapshot) => {
    const data = snap.val();
    const msgEl = document.getElementById(`msg-${snap.key}`);
    if (msgEl && data.sender === currentUser) {
      msgEl.className = `msg msg-out ${data.unread ? 'unread' : 'read'}`;
    }
  });
}

function renderChatMessage(key: string, data: any, isMe: boolean) {
  const chatBody = document.getElementById('chat-body');
  if (!chatBody) return;

  let existing = document.getElementById(`msg-${key}`);
  if (existing) return;

  const msgDiv = document.createElement('div');
  msgDiv.id = `msg-${key}`;
  const statusClass = isMe ? (data.unread ? 'unread' : 'read') : '';
  msgDiv.className = `msg ${isMe ? 'msg-out' : 'msg-in'} ${statusClass}`;

  let contentHtml = '';

  if (data.replyTo) {
    contentHtml += `<div class="msg-quote">Balasan: "${escapeHtml(data.replyTo.text)}"</div>`;
  }

  if (data.type === 'voice') {
    contentHtml += `
      <div class="voice-msg-container">
        <button class="btn-play-voice" onclick="playVoice(this, '${data.audio}')">▶</button>
        <span class="voice-tag">Pesan Suara</span>
      </div>`;
  } else if (data.type === 'image') {
    contentHtml += `<img class="msg-img" src="${data.image}" alt="Foto">`;
  } else {
    contentHtml += `<div>${escapeHtml(data.text)}</div>`;
  }

  const timeStr = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  contentHtml += `<span class="msg-time">${timeStr}</span>`;

  msgDiv.innerHTML = contentHtml;

  msgDiv.onclick = () => {
    let repText = data.text || (data.type === 'voice' ? 'Pesan Suara' : 'Gambar');
    (window as any).setReply(repText, data.sender);
  };

  chatBody.appendChild(msgDiv);
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

(window as any).setReply = function (text: string, sender: string) {
  replyingTo = { text, sender };
  const repContainer = document.getElementById('reply-preview-container');
  const repText = document.getElementById('reply-preview-text');
  if (repContainer) repContainer.style.display = 'flex';
  if (repText) repText.innerText = `Membalas ${sender === currentUser ? 'Anda' : activeContact?.name}: "${text}"`;
  document.getElementById('chat-input')?.focus();
};

(window as any).cancelReply = function () {
  replyingTo = null;
  const repContainer = document.getElementById('reply-preview-container');
  if (repContainer) repContainer.style.display = 'none';
};

(window as any).playVoice = function (btn: HTMLElement, base64: string) {
  const audio = new Audio(base64);
  btn.innerText = "⏸";
  audio.play().catch(e => console.log(e));
  audio.onended = () => {
    btn.innerText = "▶";
  };
};

(window as any).sendMsg = function () {
  if (!currentUser || !activeContact) return;
  const input = document.getElementById('chat-input') as HTMLInputElement | null;
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const roomId = [currentUser, activeContact.username].sort().join('_');
  push(ref(db, `chats/${roomId}`), {
    sender: currentUser,
    type: 'text',
    text,
    unread: true,
    timestamp: Date.now(),
    replyTo: replyingTo ? { text: replyingTo.text, sender: replyingTo.sender } : null
  });
  input.value = '';
  if (typingTimeout) clearTimeout(typingTimeout);
  update(ref(db, `status/${currentUser}`), { isTyping: false });
  (window as any).cancelReply();
};

(window as any).handleKey = function (e: KeyboardEvent) {
  if (e.key === 'Enter') {
    (window as any).sendMsg();
  }
};

(window as any).closeModals = function () {
  document.body.classList.remove('modal-open');
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    if (m.id !== 'login-modal') m.classList.remove('active');
  });
};

// -------------------------------------------------------------
// PWA INSTALLATION & OFFLINE DETECTION
// -------------------------------------------------------------

let deferredInstallPrompt: any = null;

function initPWAInstallPrompt() {
  const installBtn = document.getElementById('pwa-install-btn');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  if (isStandalone) {
    if (installBtn) installBtn.style.display = 'none';
    return;
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) installBtn.style.display = 'flex';
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (installBtn) installBtn.style.display = 'none';
    showToast("TriHive berhasil dipasang di perangkat!");
  });
}

(window as any).triggerPWAInstall = async function () {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast("Mengunduh & memasang aplikasi...");
    }
    deferredInstallPrompt = null;
  } else {
    showToast("Untuk menginstal di Android: Buka menu browser (titik 3 di kanan atas) lalu pilih 'Install App' atau 'Tambahkan ke Layar Utama'.");
  }
};

function initOfflineDetection() {
  const offlineBar = document.getElementById('offline-bar');

  function updateStatus() {
    if (!offlineBar) return;
    if (navigator.onLine) {
      offlineBar.style.display = 'none';
    } else {
      offlineBar.style.display = 'flex';
      showToast("Koneksi terputus: Mode Offline aktif (gambar & ikon tetap tersedia).");
    }
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

(window as any).handleFileUpload = function (event: Event, previewId: string) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById(previewId) as HTMLImageElement | null;
    if (preview) {
      preview.src = e.target?.result as string;
      preview.style.display = 'block';
    }
    tempUploadAvatar = e.target?.result as string;
  };
  reader.readAsDataURL(file);
};

// -------------------------------------------------------------
// APP INITIALIZATION
// -------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  buildGrid();
  initPanZoom();
  initPWAInstallPrompt();
  initOfflineDetection();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log("Service Worker TriHive aktif:", reg.scope))
      .catch(err => console.log("SW register note:", err));
  }

  if (currentUser) {
    setUserLoggedIn();
    loadUserContacts();
    setupIncomingCallsListener();
    updateNotificationButtonUI();
  } else {
    document.getElementById('login-modal')?.classList.add('active');
  }
});
