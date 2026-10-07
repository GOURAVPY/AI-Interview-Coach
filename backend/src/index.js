import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
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

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/coding', codingRoutes);

app.use(notFound);
app.use(errorHandler);

await connectDb();
app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
