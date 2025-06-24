import { google } from 'googleapis';
import fetch from 'node-fetch';

// Leemos el JSON entero del service account desde la variable de entorno
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  console.log('🟢 JSON del serviceAccount cargado OK');
} catch (err) {
  console.error('🔴 Error parseando GOOGLE_SERVICE_ACCOUNT:', err);
  serviceAccount = {};
}

// Fix para el caso de que los saltos sean literales "\n"
if (serviceAccount.private_key && serviceAccount.private_key.includes('\\n')) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  console.log('🟡 Fix aplicado a private_key');
}

// Logs para verificar datos críticos
console.log('🔑 Email:', serviceAccount.client_email);
console.log('🔑 Tiene private_key:', !!serviceAccount.private_key);
console.log('🔑 Project ID:', serviceAccount.project_id);

const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];
const projectId = serviceAccount.project_id;

async function getAccessToken() {
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    SCOPES,
    null
  );
  const tokens = await jwtClient.authorize();
  console.log('🟢 Token JWT generado');
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

    const accessToken = await getAccessToken();
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const messages = Array.isArray(tokens) ? tokens : [tokens];

    let results = [];
    for (let token of messages) {
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
