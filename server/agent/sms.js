import twilio from 'twilio';

function makeClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && token) return twilio(sid, token);
  return null;
}

const client = makeClient();

export async function sendSMS(to, body) {
  if (!client) {
    console.log(`[SMS stub] To: ${to}\n${body}`);
    return;
  }
  await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  });
}
