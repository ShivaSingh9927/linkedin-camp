import { Request, Response } from 'express';
import { prisma } from '../server';

export const addProxies = async (req: Request, res: Response): Promise<void> => {
    try {
        const { proxiesText, country, tierClass } = req.body;

        if (!proxiesText || typeof proxiesText !== 'string') {
            res.status(400).json({ success: false, error: 'proxiesText is required and must be a string' });
            return;
        }

        const lines = proxiesText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const newProxies = [];
        const errors = [];

        for (const line of lines) {
            // Expected format: ip:port:username:password
            const parts = line.split(':');

            if (parts.length >= 2) {
                const proxyIp = parts[0];
                const proxyPort = parseInt(parts[1], 10);
                const proxyUsername = parts[2] || null;
                const proxyPassword = parts[3] || null;

                if (isNaN(proxyPort)) {
                    errors.push(`Invalid port in line: ${line}`);
                    continue;
                }

                try {
                    const proxy = await prisma.proxy.create({
                        data: {
                            proxyIp: `${proxyIp}:${proxyPort}`, // Use a unique identifier
                            proxyHost: proxyIp,
                            proxyPort: proxyPort,
                            proxyUsername,
                            proxyPassword,
                            proxyCountry: country || null,
                            tierClass: tierClass || 'ECONOMY',
                            maxUsers: tierClass === 'PREMIUM' ? 5 : 15,
                            isAssigned: false
                        }
                    });
                    newProxies.push(proxy);
                } catch (e: any) {
                    if (e.code === 'P2002') {
                        errors.push(`Proxy already exists: ${proxyIp}:${proxyPort}`);
                    } else {
                        errors.push(`Failed to add ${proxyIp}:${proxyPort} - ${e.message}`);
                    }
                }
            } else {
                errors.push(`Invalid format (expected host:port[:user:pass]): ${line}`);
            }
        }

        res.json({
            success: true,
            added: newProxies.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('Error adding proxies:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const listProxies = async (req: Request, res: Response): Promise<void> => {
    try {
        const proxies = await prisma.proxy.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { assignedUsers: true }
                }
            }
        });

        res.json({ success: true, proxies });
    } catch (error) {
        console.error('Error listing proxies:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const deleteProxy = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        await prisma.proxy.delete({
            where: { id: id as string }
        });

        res.json({ success: true, message: 'Proxy deleted' });
    } catch (error) {
        console.error('Error deleting proxy:', error);
        res.status(500).json({ success: false, error: 'Failed to delete proxy' });
    }
};
