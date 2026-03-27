import { Response } from 'express';
import { prisma } from '@repo/db';

export const getSmartLists = async (req: any, res: Response) => {
    const userId = req.user.id;
    try {
        const smartLists = await prisma.smartList.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(smartLists);
    } catch (error) {
        console.error('Error fetching smart lists:', error);
        res.status(500).json({ error: 'Failed to fetch smart lists' });
    }
};

export const createSmartList = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { name, filters } = req.body;

    if (!name || !filters) {
        return res.status(400).json({ error: 'Name and filters are required' });
    }

    try {
        const smartList = await prisma.smartList.create({
            data: {
                userId,
                name,
                filters
            }
        });
        res.json(smartList);
    } catch (error) {
        console.error('Error creating smart list:', error);
        res.status(500).json({ error: 'Failed to create smart list' });
    }
};

export const deleteSmartList = async (req: any, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await prisma.smartList.delete({
            where: { id, userId }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting smart list:', error);
        res.status(500).json({ error: 'Failed to delete smart list' });
    }
};
