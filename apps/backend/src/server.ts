import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import { prisma } from '@repo/db';
import authRoutes from './routes/auth.routes';
import leadRoutes from './routes/lead.routes';
import campaignRoutes from './routes/campaign.routes';
import statsRoutes from './routes/stats.routes';
import { initScheduler } from './cron/scheduler';
import { initWorker } from './workers/linkedin.worker';


const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: true,
    credentials: true,
}));

// Chrome 144+ Private Network Access (PNA) support
// Without this, Chrome blocks ALL requests from public websites/extensions to localhost
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    // Handle PNA preflight requests
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        return res.status(204).end();
    }

    next();
});
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/campaigns', campaignRoutes);
app.use('/api/v1/stats', statsRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'LinkedIn Campaign Engine API is running', version: '1.0.0' });
});

// Initialize Campaign Engine
initScheduler();
initWorker();

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Waalaxy Replication Backend is running' });
});

app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} (0.0.0.0)`);
});

export { app, prisma };
