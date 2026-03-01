import { Router } from 'express';
import { runBriefingForUser } from '../agent/index.js';

const router = Router();

// POST /api/agent/run
// Body: { type: 'am' | 'pm' }
// Manual trigger used by Settings page and for testing.
// Returns immediately — briefing runs async (takes 15-30s).
router.post('/run', async (req, res) => {
  const { type } = req.body;

  if (!type || !['am', 'pm'].includes(type)) {
    return res.status(400).json({ error: 'type must be "am" or "pm"' });
  }

  runBriefingForUser(req.userId, type).catch(err =>
    console.error('manual briefing error:', err.message)
  );

  res.json({ status: 'started', type });
});

export default router;
