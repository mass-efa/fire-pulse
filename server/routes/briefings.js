import { Router } from 'express';
import supabase from '../db/client.js';

const router = Router();

// GET /api/briefings?type=am|pm&limit=20&offset=0
// Paginated full history for the History page.
router.get('/', async (req, res) => {
  const { type, limit = 20, offset = 0 } = req.query;

  let query = supabase
    .from('briefings')
    .select('*')
    .eq('user_id', req.userId)
    .order('sent_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (type) query = query.eq('briefing_type', type);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/briefings/latest
// Returns the most recent completed AM and PM briefing.
// Must be defined before /:id if that route is ever added.
router.get('/latest', async (req, res) => {
  const [am, pm] = await Promise.all([
    supabase
      .from('briefings')
      .select('*')
      .eq('user_id', req.userId)
      .eq('briefing_type', 'am')
      .eq('status', 'completed')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('briefings')
      .select('*')
      .eq('user_id', req.userId)
      .eq('briefing_type', 'pm')
      .eq('status', 'completed')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  res.json({ am: am.data ?? null, pm: pm.data ?? null });
});

export default router;
