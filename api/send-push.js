import { google } from 'googleapis';
import fetch from 'node-fetch';

const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];

function obtenerServiceAccount() {
  const b64Env = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  if (!b64Env) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 no definida');

  const decodedJson = Buffer.from(b64Env, 'base64').toString('utf8').trim();
  const serviceAccount = JSON.parse(decodedJson);

  // Fix explícito para saltos de línea
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

  if (!serviceAccount.private_key.startsWith('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('La private_key no tiene un formato válido.');
  }

  return serviceAccount;
}

async function getAccessToken(serviceAccount) {
  const jwtClient = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: SCOPES
  });

  const tokens = await jwtClient.authorize();
  console.log('🟢 Token JWT generado correctamente');
  return tokens.access_token;
}

export default async function handler(req, res) {
  console.log('📩 Nueva request recibida:', req.method, req.body);

  if (req.method !== 'POST') {
    console.warn('⛔ Método no permitido');
    return res.status(405).end();
  }

  try {
    const { tokens, title, body, data } = req.body;

    if (!tokens || !title || !body) {
      console.warn('⛔ Faltan datos requeridos en la request');
      return res.status(400).json({ error: 'Faltan datos requeridos.' });
    }

    const serviceAccount = obtenerServiceAccount();
    console.log('🔑 serviceAccount cargado:', {
      email: serviceAccount.client_email,
      project: serviceAccount.project_id,
      keyPreview: serviceAccount.private_key.slice(0, 30) + '...'
    });

    const accessToken = await getAccessToken(serviceAccount);
    const url = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    const messages = Array.isArray(tokens) ? tokens : [tokens];
    const results = [];

    for (const token of messages) {
      const message = {
        message: {
          token,
          notification: { title, body },
          data: data || {}
        }
      };

      const fcmRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });
      const fcmData = await fcmRes.json();
      console.log(`📤 Push enviada a: ${token} → Respuesta FCM:`, fcmData);
      results.push({ token, response: fcmData });
    }

    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('❌ Error en send-push API:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
