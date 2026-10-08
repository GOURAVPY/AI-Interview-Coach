import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/authRoutes.js';
import codingRoutes from './routes/codingRoutes.js';
import demoRoutes from './routes/demoRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import usageRoutes from './routes/usageRoutes.js';

const app = express();

// Behind a reverse proxy (Render, Nginx, Cloudflare) set TRUST_PROXY=1 so req.ip is the visitor, not the proxy.
if (env.trustProxy) app.set('trust proxy', Number.isNaN(Number(env.trustProxy)) ? env.trustProxy : Number(env.trustProxy));

// The default policy plus the one thing this app needs: the Gemini Live WebSocket.
// Everything else stays locked to this origin, and nothing may evaluate strings as code.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'connect-src': ["'self'", 'https://generativelanguage.googleapis.com', 'wss://generativelanguage.googleapis.com'],
        'worker-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'upgrade-insecure-requests': null, // the host already serves HTTPS; this would break local http testing
      },
    },
  }),
);
app.use(compression());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/coding', codingRoutes);
app.use('/api', notFound);

// In production the built frontend is served from the same server, so there is one URL
// and login cookies stay first-party. In development Vite serves the frontend instead.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders(res, filePath) {
        // Files in /assets have a hash in their name, so they can be cached for a year.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        // The test runner must evaluate the candidate's code, so it gets its own policy: eval is allowed
        // there and nowhere else, and it has no network access at all.
        if (path.basename(filePath) === 'runner-worker.js') {
          res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'");
        }
      },
    }),
  );
  // Any other page address belongs to the React router.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

await connectDb();
app.listen(env.port, () => console.log(`Server listening on port ${env.port}`));
