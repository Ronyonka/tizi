const admin = require('firebase-admin');

// Trying to init admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(require('./tizi-a51ed-firebase-adminsdk-fbsvc-c8a8167fcd.json')),
  });
} catch(e) {
  // might already be initialized or file missing, let's see
  console.log("Init error:", e.message);
}

const db = admin.firestore();

async function run() {
  console.log('--- LOGS ---');
  const logsSnap = await db.collection('logs').limit(5).get();
  logsSnap.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });

  console.log('--- EXERCISES ---');
  const exSnap = await db.collection('exercises').limit(5).get();
  exSnap.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}

run().catch(console.error);
