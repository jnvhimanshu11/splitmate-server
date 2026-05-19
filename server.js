const express = require('express');
const cors    = require('cors');
const admin   = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// ── Init Firebase Admin using env var ────────────────────────────────────────
let messaging;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  messaging = admin.messaging();
  console.log('Firebase Admin initialized ✅');
} catch(e) {
  console.error('Firebase Admin init failed:', e.message);
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'SplitMate notification server running ✅' });
});

// ── Send notification endpoint ────────────────────────────────────────────────
// POST /send-notification
// Body: { tokens: [...], title: "...", body: "...", url: "..." }
app.post('/send-notification', async (req, res) => {
  const { tokens, title, body, url } = req.body;

  if (!tokens || !tokens.length || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields: tokens, title, body' });
  }

  if (!messaging) {
    return res.status(500).json({ error: 'Firebase not initialized. Check FIREBASE_SERVICE_ACCOUNT env var.' });
  }

  try {
    const results = await Promise.allSettled(
      tokens.map(token =>
        messaging.send({
          token,
          notification: { title, body },
          webpush: {
            notification: {
              title, body,
              icon:  '/icon-192.png',
              badge: '/icon-72.png',
              requireInteraction: false
            },
            fcm_options: {
              link: url || 'https://thebohothread.in/dashboard.html'
            }
          }
        })
      )
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const errors = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason?.message || 'Unknown error');

    console.log(`Sent: ${sent}, Failed: ${failed}`);
    res.json({ sent, failed, errors });

  } catch(e) {
    console.error('Send error:', e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
