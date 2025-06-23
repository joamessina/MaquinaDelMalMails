import { google } from 'googleapis';
import fetch from 'node-fetch';

const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
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
  return tokens.access_token;
}

export default async function handler(req, res) {
    console.log('📩 Nueva request recibida:', req.method, req.body);
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { tokens, title, body, data } = req.body; 
    console.log('🟡Tokens recibidos:', tokens);
    console.log('🟡Title:', title, 'Body:', body, 'Data:', data);

    if (!tokens || !title || !body) {
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
      results.push({ token, response: fcmData });
    }

    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error(err);
    console.error('❌ Error en send-push API:', err);

    res.status(500).json({ success: false, error: err.message });
  }
}
