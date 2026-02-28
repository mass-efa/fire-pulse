import supabase from '../db/client.js';

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createOTP(phone) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  const { error } = await supabase
    .from('otp_codes')
    .insert({ phone, code, expires_at: expiresAt });

  if (error) throw error;
  return code;
}

export async function verifyOTP(phone, code) {
  // Most recent unused OTP for this phone
  const { data, error } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', phone)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  const otp = data?.[0];
  if (!otp)                                return { valid: false, reason: 'not_found' };
  if (otp.blocked)                         return { valid: false, reason: 'blocked' };
  if (new Date(otp.expires_at) < new Date()) return { valid: false, reason: 'expired' };

  if (otp.code !== code) {
    const newAttempts = otp.attempts + 1;
    const blocked = newAttempts >= 5;
    await supabase
      .from('otp_codes')
      .update({ attempts: newAttempts, blocked })
      .eq('id', otp.id);
    return {
      valid: false,
      reason: 'invalid',
      attemptsRemaining: blocked ? 0 : 5 - newAttempts,
      blocked,
    };
  }

  // Valid — mark used
  await supabase.from('otp_codes').update({ used: true }).eq('id', otp.id);
  return { valid: true };
}
