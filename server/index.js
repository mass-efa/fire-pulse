import express from 'express';
import cors from 'cors';

import requireAuth from './middleware/requireAuth.js';
import { startScheduler } from './scheduler/index.js';
import authRoutes from './routes/auth.js';
import portfolioRoutes from './routes/portfolio.js';
import briefingsRoutes from './routes/briefings.js';
import agentRoutes from './routes/agent.js';
import settingsRoutes from './routes/settings.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// Public routes
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/portfolio', requireAuth, portfolioRoutes);
app.use('/api/briefings', requireAuth, briefingsRoutes);
app.use('/api/agent', requireAuth, agentRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`fire-pulse server running on port ${PORT}`);
  startScheduler();
});
