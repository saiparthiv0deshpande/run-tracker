import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import runRoutes from './routes/runs.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const mongoUri = process.env.MONGODB_URI;
const isProduction = process.env.NODE_ENV === 'production';

if (!mongoUri) {
  throw new Error('MONGODB_URI is required. Add your MongoDB Atlas connection string to backend/.env.');
}
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required. Add a long random value to backend/.env.');
}

if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors({ origin: clientOrigins, credentials: true }));
app.use(express.json({ limit: '8mb' }));
app.use(session({
  name: 'stride.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 14 * 24 * 60 * 60 * 1000
  },
  store: MongoStore.create({ mongoUrl: mongoUri, collectionName: 'sessions', ttl: 14 * 24 * 60 * 60 })
}));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, message: 'Run tracker API is running' });
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/runs', runRoutes);

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error.code === 11000) return response.status(409).json({ message: 'An account with that email already exists.' });
  response.status(500).json({ message: 'The server could not complete that request.' });
});

await mongoose.connect(mongoUri);
console.log('Connected to MongoDB.');

app.listen(port, '0.0.0.0', () => {
  console.log(`API running at http://localhost:${port}`);
});
