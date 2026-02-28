import { Router } from 'express';
import supabase from '../db/client.js';
import { createOTP, verifyOTP } from '../auth/otp.js';
import { signToken } from '../auth/jwt.js';
import { sendSMS } from '../agent/sms.js';

const router = Router();

// POST /api/auth/request-otp
// Body: { phone, name? }
// name is required only for new users. If phone is unknown and name is missing,
// returns { needsName: true } so the client can show the name field.
router.post('/request-otp', async (req, res) => {
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone is required' });

  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .limit(1);

    const isNewUser = !existing?.length;

    if (isNewUser && !name) {
      return res.json({ needsName: true });
    }

    const code = await createOTP(phone);
    await sendSMS(phone, `Your fire-pulse code: ${code}`);

    res.json({ sent: true });
  } catch (err) {
    console.error('request-otp error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
// Body: { phone, code, name? }
// name is forwarded from the client for new-user creation.
router.post('/verify-otp', async (req, res) => {
  const { phone, code, name } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });

  try {
    const result = await verifyOTP(phone, code);

    if (!result.valid) {
      if (result.reason === 'blocked') {
        return res.status(429).json({ error: 'Too many attempts. Try again in 24 hours.' });
      }
      return res.status(401).json({
        error: result.reason === 'expired' ? 'Code expired' : 'Invalid code',
        attemptsRemaining: result.attemptsRemaining,
        blocked: result.blocked ?? false,
      });
    }

    // Find or create user
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .limit(1);

    let user = existing?.[0];

    if (!user) {
      if (!name) return res.status(400).json({ error: 'Name is required for new users' });

      const { data: created, error } = await supabase
        .from('users')
        .insert({ name, phone })
        .select()
        .single();

      if (error) throw error;
      user = created;
    } else {
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);
      user.last_login_at = new Date().toISOString();
    }

    const token = signToken(user.id);
    res.json({ token, user });
  } catch (err) {
    console.error('verify-otp error:', err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
