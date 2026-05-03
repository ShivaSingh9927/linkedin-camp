import { prisma } from '@repo/db';

export const getOrAssignProxy = async (userId: string, detectedCountry?: string): Promise<any> => {
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) throw new Error('User not found');

    return null;
};