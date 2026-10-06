import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/authRoutes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);

app.use(notFound);
app.use(errorHandler);

await connectDb();
app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
