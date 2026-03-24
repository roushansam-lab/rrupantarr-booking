// api/book.js — Vercel Serverless Function
// Receives booking POSTs from the frontend and creates a Google Calendar event

import { google } from 'googleapis';

export default async function handler(req, res) {
  // ── CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, phone, email, service, date, time, notes } = req.body;

    // ── Validate
    if (!name || !service || !date) {
      return res.status(400).json({ success: false, error: 'Missing required fields: name, service, date' });
    }

    // ── Auth with Google Service Account
    const keyJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials: keyJson,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // ── Build event times (IST)
    const apptTime = time || '10:00';
    const startDT  = new Date(`${date}T${apptTime}:00+05:30`);
    const endDT    = new Date(startDT.getTime() + 60 * 60 * 1000); // +1 hour

    const fmt = (d) => d.toISOString().replace('Z', '+05:30');

    const event = {
      summary: `💄 ${service} — ${name}`,
      description: [
        `👤 Client: ${name}`,
        `📞 Phone: ${phone || 'N/A'}`,
        `📧 Email: ${email || 'N/A'}`,
        `💅 Service: ${service}`,
        `📅 Date: ${date} at ${apptTime}`,
        notes ? `📝 Notes: ${notes}` : '',
        `\n— Booked via RRUPANTARR website`,
      ].filter(Boolean).join('\n'),
      start: { dateTime: fmt(startDT), timeZone: 'Asia/Kolkata' },
      end:   { dateTime: fmt(endDT),   timeZone: 'Asia/Kolkata' },
      location: 'RRUPANTARR Unisex Salon & Makeup Studio, Lucknow, Uttar Pradesh',
      colorId: '11',  // Red/Tomato in Google Calendar
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email',  minutes: 60 },
          { method: 'popup',  minutes: 30 },
        ],
      },
    };

    const calendarId = process.env.CALENDAR_ID || 'primary';
    const response   = await calendar.events.insert({ calendarId, requestBody: event });

    console.log(`✅ Booking created: ${response.data.id} for ${name} — ${service} on ${date}`);

    return res.status(200).json({
      success:   true,
      eventId:   response.data.id,
      eventLink: response.data.htmlLink,
      message:   `Appointment confirmed for ${name} on ${date} at ${apptTime}`,
    });

  } catch (err) {
    console.error('❌ Booking error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
