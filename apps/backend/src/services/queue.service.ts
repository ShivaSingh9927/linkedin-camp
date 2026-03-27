import { Queue } from 'bullmq';
import Redis from 'ioredis';

let actionQueue: Queue | null = null;
let redisConnection: Redis | null = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const getActionQueue = () => {
    if (!actionQueue) {
        if (!redisConnection) {
            redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
        }
        actionQueue = new Queue('linkedin-actions', { 
            connection: redisConnection as any,
            defaultJobOptions: {
                removeOnComplete: true,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            }
        });
    }
    return actionQueue;
};
