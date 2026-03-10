import { prisma } from '../server';

/**
 * Checks if the current time for a user is within their allowed working hours.
 * Default: Monday to Friday, 9:00 AM to 6:00 PM.
 */
export const canWorkNow = async (userId: string): Promise<{ allowed: boolean; nextStartTime?: Date }> => {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Waalaxy Strategy: Advanced Wait States (Respect custom business hours)
    const workingDays = user?.workingDays || [1, 2, 3, 4, 5]; // Default Mon-Fri
    const hours = (user?.workingHours as any) || { start: 9, end: 18 };
    const startHour = hours.start;
    const endHour = hours.end;

    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    const isAllowedDay = workingDays.includes(day);
    const isAllowedHour = hour >= startHour && hour < endHour;

    if (isAllowedDay && isAllowedHour) {
        return { allowed: true };
    }

    // Calculate next start time
    const nextStart = new Date();
    nextStart.setUTCMinutes(0);
    nextStart.setUTCSeconds(0);
    nextStart.setUTCMilliseconds(0);

    if (!isAllowedDay || hour >= endHour) {
        // Move to tomorrow morning
        nextStart.setUTCDate(nextStart.getUTCDate() + 1);
        nextStart.setUTCHours(startHour);

        // If tomorrow is not a working day, skip until the next one
        while (!workingDays.includes(nextStart.getUTCDay())) {
            nextStart.setUTCDate(nextStart.getUTCDate() + 1);
        }
    } else if (hour < startHour) {
        // Today, but later
        nextStart.setUTCHours(startHour);
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
