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

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  /^http:\/\/192\.168\.\d+\.\d+:5173$/,
].filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // server-to-server / curl
    const ok = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    cb(ok ? null : new Error('Not allowed by CORS'), ok);
  },
}));
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
