import { prisma } from '@repo/db';

export const leadTagService = {
    async addTag(leadId: string, tag: string): Promise<void> {
        await prisma.leadTag.upsert({
            where: {
                leadId_tag: {
                    leadId,
                    tag
                }
            },
            create: {
                leadId,
                tag
            },
            update: {
                createdAt: new Date()
            }
        });
    },

    async removeTag(leadId: string, tag: string): Promise<void> {
        await prisma.leadTag.deleteMany({
            where: {
                leadId,
                tag
            }
        }).catch(() => {});
    },

    async getTags(leadId: string): Promise<string[]> {
        const tags = await prisma.leadTag.findMany({
            where: { leadId }
        });
        return tags.map(t => t.tag);
    },

    async getLeadsByTag(userId: string, tag: string): Promise<any[]> {
        const leads = await prisma.leadTag.findMany({
            where: {
                tag,
                Lead: {
                    userId
                }
            },
            include: {
                Lead: true
            }
        });
        return leads.map(t => t.Lead);
    },

    async getLeadsByTags(userId: string, tags: string[]): Promise<any[]> {
        const leads = await prisma.leadTag.findMany({
            where: {
                tag: { in: tags },
                Lead: {
                    userId
                }
            },
            include: {
                Lead: true
            }
        });
        
        const seen = new Set();
        return leads
            .map(t => t.Lead)
            .filter(lead => {
                if (seen.has(lead.id)) return false;
                seen.add(lead.id);
                return true;
            });
    }
};