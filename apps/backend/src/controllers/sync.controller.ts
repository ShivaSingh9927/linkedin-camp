import { Response } from 'express';
import { prisma } from '@repo/db';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

export const uploadSessionZip = async (req: any, res: Response) => {
    const userId = req.user.id;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No session ZIP provided.' });
    }

    try {
        console.log(`[SYNC] Received session ZIP for user ${userId} (${req.file.size} bytes)`);
        
        const zip = new AdmZip(req.file.buffer);
        const extractPath = path.join(process.cwd(), 'sessions', userId);
        
        // Ensure parent sessions dir exists
        const sessionsParent = path.join(process.cwd(), 'sessions');
        if (!fs.existsSync(sessionsParent)) {
            fs.mkdirSync(sessionsParent, { recursive: true });
        }

        // Clean up old session if exists to avoid mixing
        if (fs.existsSync(extractPath)) {
            console.log(`[SYNC] Cleaning up existing session for ${userId}`);
            fs.rmSync(extractPath, { recursive: true, force: true });
        }
        
        fs.mkdirSync(extractPath, { recursive: true });

        // Extract ZIP
        zip.extractAllTo(extractPath, true);
        console.log(`[SYNC] Extracted session for user ${userId} to ${extractPath}`);

        // Try to find the li_at cookie in the browser profiles (e.g. from cookies.sqlite or persistent JSON)
        // If we can't find it easily, the first cloud run will pick it up from the context.
        
        await prisma.user.update({
            where: { id: userId },
            data: { 
                persistentSessionPath: extractPath,
                linkedinActiveInBrowser: false // Reset for cloud takeoff
            }
        });

        res.json({ 
            success: true, 
            message: 'Session synced successfully! Your cloud automation is now live.' 
        });

    } catch (error: any) {
        console.error(`[SYNC] Error uploading session for ${userId}:`, error.message);
        res.status(500).json({ error: 'Failed to extract session. Please try again.' });
    }
};
