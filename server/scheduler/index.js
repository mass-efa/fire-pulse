import cron from 'node-cron';
import Holidays from 'date-holidays';
import supabase from '../db/client.js';
import { runBriefingForAllUsers } from '../agent/index.js';
import { sendSMS } from '../agent/sms.js';

const hd = new Holidays('US');

// ─── MARKET HOLIDAY DETECTION ─────────────────────────────────────────────────
// NYSE observes these US federal holidays plus Good Friday (non-federal).
const NYSE_HOLIDAY_KEYWORDS = [
  'New Year',
  'Martin Luther King',
  'Washington',
  'Memorial',
  'Juneteenth',
  'Independence',
  'Labor',
  'Thanksgiving',
  'Christmas',
];

function isNYSEHoliday(date) {
  const holidays = hd.isHoliday(date);
  const isFederal = Array.isArray(holidays) && holidays.some(h =>
    NYSE_HOLIDAY_KEYWORDS.some(kw => h.name.includes(kw))
  );
  return isFederal || isGoodFriday(date);
}

// Good Friday = 2 days before Easter.
// NYSE observes it but it is NOT a US federal holiday.
function isGoodFriday(date) {
  const easter = getEasterDate(date.getFullYear());
  const gf = new Date(easter);
  gf.setDate(gf.getDate() - 2);
  return date.toDateString() === gf.toDateString();
}

// Anonymous Gregorian algorithm for Easter Sunday.
function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// ─── CORE RUNNER ─────────────────────────────────────────────────────────────
async function runOrSkip(briefingType) {
  const now = new Date();
  // Construct a local-midnight date so date-holidays compares the correct calendar day,
  // regardless of whether the server is running in UTC or a local timezone.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  console.log(`scheduler: ${briefingType.toUpperCase()} run triggered — ${now.toISOString()}`);

  if (isNYSEHoliday(today)) {
    console.log('scheduler: market holiday detected — sending holiday SMS');
    const { data: users } = await supabase
      .from('users')
      .select('phone, am_briefing_enabled, pm_briefing_enabled');

    for (const user of users ?? []) {
      if (!user.phone) continue;
      if (!user[`${briefingType}_briefing_enabled`]) continue;
      await sendSMS(
        user.phone,
        "🔥 fire-pulse: Market's taking a break today. Go touch grass (or be a degen elsewhere). See you tomorrow."
      ).catch(err => console.error('holiday SMS error:', err.message));
    }
    return;
  }

  await runBriefingForAllUsers(briefingType);
}

// ─── CRON JOBS ────────────────────────────────────────────────────────────────
export function startScheduler() {
  // 7:00 AM PST = 15:00 UTC, Mon–Fri
  cron.schedule('0 15 * * 1-5', () =>
    runOrSkip('am').catch(err => console.error('scheduler AM error:', err.message))
  );

  // 12:00 PM PST = 20:00 UTC, Mon–Fri
  cron.schedule('0 20 * * 1-5', () =>
    runOrSkip('pm').catch(err => console.error('scheduler PM error:', err.message))
  );

  // Nightly OTP cleanup — 2:00 AM UTC
  cron.schedule('0 2 * * *', async () => {
    const { error } = await supabase
      .from('otp_codes')
      .delete()
      .lt('expires_at', new Date().toISOString());
    if (error) console.error('OTP cleanup error:', error.message);
    else console.log('scheduler: expired OTP codes cleaned up');
  });

  console.log('Scheduler started — AM: 07:00 PST | PM: 12:00 PST | Cleanup: 02:00 UTC (Mon–Fri)');
}
