import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../server';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
    };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

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
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

