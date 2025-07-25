import nodemailer from 'nodemailer';

export default async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Método no permitido');
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      res.status(400).json({ error: 'Body malformado' });
      return;
    }
  }

  const { to, subject, text, html } = body || {};
  if (!to || !subject || (!text && !html)) {
    res.status(400).json({ error: 'Faltan datos requeridos' });
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  try {
    await transporter.sendMail({
      from: `"Restaurante La Comanda" <${process.env.MAIL_USER}>`,
      to,
      subject,
      text,
      html
    });
    res.status(200).json({ success: true, message: 'Mail enviado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error enviando el mail', details: error.message });
  }
};
