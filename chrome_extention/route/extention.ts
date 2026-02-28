import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

// --- ZOD SCHEMAS FOR VALIDATION ---

const syncCookieSchema = z.object({
  userId: z.string().uuid(), // In a real app, get this from a JWT auth middleware
  li_at: z.string().min(10, "Invalid LinkedIn cookie"),
});

const importLeadsSchema = z.object({
  userId: z.string().uuid(),
  leads: z.array(
    z.object({
      linkedinUrl: z.string().url(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      jobTitle: z.string().optional(),
      company: z.string().optional(),
    })
  ),
});

// --- API ENDPOINTS ---

/**
 * POST /api/extension/sync-cookie
 * Purpose: Receives the hijacked li_at cookie from the Background Worker and saves it.
 */
router.post('/sync-cookie', async (req, res) => {
  try {
    // 1. Validate the incoming payload
    const { userId, li_at } = syncCookieSchema.parse(req.body);

    // 2. Update the user in the database
    const user = await prisma.user.update({
      where: { id: userId },
      data: { linkedinCookie: li_at },
    });

    res.status(200).json({ success: true, message: "Cookie synced successfully." });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/extension/import-leads
 * Purpose: Receives an array of scraped profiles from the Content Script and adds them to the CRM.
 */
router.post('/import-leads', async (req, res) => {
  try {
    // 1. Validate the array of leads
    const { userId, leads } = importLeadsSchema.parse(req.body);

    // 2. Format data for Prisma
    const leadsToInsert = leads.map(lead => ({
      userId,
      linkedinUrl: lead.linkedinUrl,
      firstName: lead.firstName || "Unknown",
      lastName: lead.lastName || "",
      jobTitle: lead.jobTitle || "",
      company: lead.company || "",
      status: 'UNCONNECTED' // From our Prisma Enum
    }));

    // 3. Insert into database (skipDuplicates prevents crashing if a user imports the same page twice)
    const result = await prisma.lead.createMany({
      data: leadsToInsert,
      skipDuplicates: true, 
    });

    res.status(201).json({ 
      success: true, 
      message: `Imported ${result.count} new leads.` 
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;