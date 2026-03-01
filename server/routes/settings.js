import { Router } from 'express';
import supabase from '../db/client.js';

const router = Router();

// GET /api/settings
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.userId)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PUT /api/settings
router.put('/', async (req, res) => {
  const { name, am_briefing_enabled, pm_briefing_enabled } = req.body;
  const updates = {};
  if (name                  !== undefined) updates.name                  = name;
  if (am_briefing_enabled   !== undefined) updates.am_briefing_enabled   = am_briefing_enabled;
  if (pm_briefing_enabled   !== undefined) updates.pm_briefing_enabled   = pm_briefing_enabled;

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.userId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
