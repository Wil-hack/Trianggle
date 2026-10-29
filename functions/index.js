const { onValueCreated } = require('firebase-functions/v2/database');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const REGION = 'asia-southeast1';
const INSTANCE = 'trihive-857cd-default-rtdb';

async function push(user, message) {
  const db = getDatabase();
  const token = (await db.ref(`fcmTokens/${user}`).get()).val();
  if (!token) return;
  try {
    await getMessaging().send({ token, ...message });
  } catch (e) {
    if (e.code === 'messaging/registration-token-not-registered') {
      await db.ref(`fcmTokens/${user}`).remove();
    }
    console.error('Gagal kirim push:', e.code || e.message);
  }
}

exports.notifyMessage = onValueCreated(
  { ref: '/chats/{roomId}/{msgId}', region: REGION, instance: INSTANCE },
  async (event) => {
    const msg = event.data.val();
    if (!msg || !msg.sender) return;
    const db = getDatabase();
    const contacts = (await db.ref(`user_contacts/${msg.sender}`).get()).val() || {};
    const recipient = Object.keys(contacts).find(
      (c) => [msg.sender, c].sort().join('_') === event.params.roomId
    );
    if (!recipient) return;
    const name = (await db.ref(`users/${msg.sender}/displayName`).get()).val() || msg.sender;
    const body = msg.type === 'text' && msg.text ? String(msg.text).slice(0, 200) : 'Mengirim lampiran';
    await push(recipient, {
      notification: { title: name, body },
      data: { type: 'chat', from: String(msg.sender) },
      android: { priority: 'high', notification: { sound: 'default' } },
    });
  }
);

exports.notifyCall = onValueCreated(
  { ref: '/calls/{target}', region: REGION, instance: INSTANCE },
  async (event) => {
    const call = event.data.val();
    if (!call || call.status !== 'calling') return;
    const name = call.callerName || call.caller || 'Seseorang';
    await push(event.params.target, {
      notification: {
        title: 'Panggilan masuk',
        body: `${name} menelepon${call.isVideo ? ' (video)' : ''}`,
      },
      data: { type: 'call', from: String(call.caller || '') },
      android: { priority: 'high', ttl: 30000, notification: { sound: 'default' } },
    });
  }
);
