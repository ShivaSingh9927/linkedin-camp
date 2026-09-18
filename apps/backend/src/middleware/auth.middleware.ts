import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@repo/db';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
    };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = (req.headers.authorization?.split(' ')[1]) || (req.query.token as string);

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };

        // Verify user still exists in DB
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
            return res.status(401).json({ error: 'User no longer exists. Please register again.', code: 'USER_NOT_FOUND' });
        }

        req.user = decoded;

        // Stamp human presence, throttled to once an hour.
        //
        // This is the ONLY signal that the person is using Qampi:
        // lastBrowserActivityAt is their LinkedIn session and lastCloudActionAt
        // is automation running — both can be fresh while the user hasn't
        // opened the app in a month, which is exactly who the re-engagement
        // email is for. Fire-and-forget: presence is never worth failing a
        // request over, and one write per user per hour is noise-level load.
        const lastSeen = (user as any).lastSeenAt as Date | null;
        if (!lastSeen || Date.now() - new Date(lastSeen).getTime() > 3_600_000) {
            void prisma.user.update({
                where: { id: decoded.id },
                data: { lastSeenAt: new Date() } as any,
            }).catch(() => {});
        }

        // ACCOUNT SWITCHER / GHOSTING LOGIC
        const operatingUserId = req.headers['x-operating-user-id'] as string;
        if (operatingUserId && operatingUserId !== decoded.id) {
            // Verify if decoded.id is an ADMIN of a team that operatingUserId is a MEMBER of
            const adminCheck = await prisma.teamMember.findFirst({
                where: {
                    userId: decoded.id,
                    role: 'ADMIN',
                    Team: {
                        TeamMember: {
                            some: { userId: operatingUserId }
                        }
                    }
                }
            });

            if (adminCheck) {
                // The requester is an admin for this user. Allow ghosting.
                const targetUser = await prisma.user.findUnique({ where: { id: operatingUserId } });
                if (targetUser) {
                    req.user = { id: targetUser.id, email: targetUser.email };
                    // Optionally attach a flag indicating ghost mode, though not strictly required
                    (req as any).isGhosting = true;
                }
            }
        }

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
