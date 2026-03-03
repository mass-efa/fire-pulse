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
  // Allow any Vite dev port (5173–5179) so port bumps don't break CORS
  /^http:\/\/localhost:517[0-9]$/,
  /^http:\/\/192\.168\.\d+\.\d+:517[0-9]$/,
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
const server = app.listen(PORT, () => {
  console.log(`fire-pulse server running on port ${PORT}`);
  startScheduler();
});

// Graceful shutdown so node --watch hot-reloads release the port cleanly
function shutdown() { server.close(() => process.exit(0)); }
process.on('SIGTERM', shutdown);
process.on('SIGUSR2', shutdown);
