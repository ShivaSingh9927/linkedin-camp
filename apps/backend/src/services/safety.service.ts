import { prisma } from '../server';

/**
 * Checks if the current time for a user is within their allowed working hours.
 * Default: Monday to Friday, 9:00 AM to 6:00 PM.
 */
export const canWorkNow = async (userId: string): Promise<{ allowed: boolean; nextStartTime?: Date }> => {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Default config if not on User model yet
    const config = {
        days: [0, 1, 2, 3, 4, 5, 6], // All days
        startHour: 0,
        endHour: 24,
        timezone: 'UTC',
    };

    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    const isAllowedDay = config.days.includes(day);
    const isAllowedHour = hour >= config.startHour && hour < config.endHour;

    if (isAllowedDay && isAllowedHour) {
        return { allowed: true };
    }

    // Calculate next start time
    const nextStart = new Date();
    nextStart.setUTCMinutes(0);
    nextStart.setUTCSeconds(0);
    nextStart.setUTCMilliseconds(0);

    if (!isAllowedDay || hour >= config.endHour) {
        // Move to tomorrow morning
        nextStart.setUTCDate(nextStart.getUTCDate() + 1);
        nextStart.setUTCHours(config.startHour);

        // If tomorrow is weekend, skip to Monday
        while (!config.days.includes(nextStart.getUTCDay())) {
            nextStart.setUTCDate(nextStart.getUTCDate() + 1);
        }
    } else if (hour < config.startHour) {
        // Today, but later
        nextStart.setUTCHours(config.startHour);
    }

    return { allowed: false, nextStartTime: nextStart };
};

/**
 * Adds a random jitter to a date.
 * variance: 0.2 means +/- 20% of the difference from NOW.
 * Or if it's a fixed duration, just add random minutes.
 */
export const applyJitter = (date: Date, minMinutes = 5, maxMinutes = 45): Date => {
    const jitter = Math.floor(Math.random() * (maxMinutes - minMinutes + 1) + minMinutes);
    return new Date(date.getTime() + (jitter * 60 * 1000));
};

export const getRandomUserAgent = () => {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Edge/121.0.0.0',
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
};
