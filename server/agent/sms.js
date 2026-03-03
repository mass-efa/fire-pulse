import twilio from 'twilio';

function makeClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && token) return twilio(sid, token);
  return null;
}

const client = makeClient();
const isDev = process.env.NODE_ENV !== 'production';

if (client) {
  console.log('[SMS] Twilio client initialised (real)');
} else {
  console.log('[SMS] Twilio credentials missing — using console stub');
}

export async function sendSMS(to, body) {
  if (!client) {
    console.log(`[SMS stub] To: ${to}\n${body}`);
    return;
  }
  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
  } catch (err) {
    // Twilio error code 21608 = trial account, unverified destination number.
    // In development fall back to console so the full auth flow stays testable.
    if (isDev) {
      console.warn(`[SMS dev-fallback] Twilio error ${err.code}: ${err.message}`);
      console.log(`[SMS dev-fallback] To: ${to}\n${body}`);
      return;
    }
    throw err;
  }
}
