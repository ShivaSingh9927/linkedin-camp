import { Response } from 'express';
import { prisma } from '@repo/db';
import crypto from 'crypto';
import { featureAllowed } from '../campaign-engine/safety/quota';
import { maxSeatsForTier } from '../config/plans';
import { mailService } from '../services/mail.service';

// Owners and admins may manage the team (invite/remove seats, billing). Plain
// members can only run their own campaigns. Ownership is also tracked via
// Team.ownerId; the OWNER role is assigned to the creator.
const canManageTeam = (role: string | undefined | null) => role === 'OWNER' || role === 'ADMIN';

// The frontend expects lowercase `user` / `members` / `invites` keys, but the
// generated Prisma client exposes the relations capitalized (Team / TeamMember /
// TeamInvite / User). Reshape a member row (capitalized relations) into the
// wire shape the UI consumes.
const shapeMember = (m: any) => ({
    id: m.id,
    role: m.role,
    joinedAt: m.createdAt,
    userId: m.userId,
    user: m.User ? { id: m.User.id, email: m.User.email } : undefined,
});

// Get current user's team
export const getMyTeam = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        // Find the team member entry for this user
        const member = await prisma.teamMember.findFirst({
            where: { userId },
            include: {
                Team: {
                    include: {
                        TeamMember: {
                            include: {
                                User: { select: { id: true, email: true } },
                            },
                        },
                        TeamInvite: { where: { status: 'PENDING' } },
                    },
                },
            },
        });

        if (!member) {
            return res.json({ hasTeam: false });
        }

        const team = member.Team;

        // Per-member stats for the admin console. Each is scoped to that member's
        // own private data — Phase 1 teams aggregate visibility, not shared leads.
        const membersWithStats = await Promise.all(team.TeamMember.map(async (m) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [activeCampaigns, totalLeads, invitesToday, messagesToday, totalReplies, userRecord] = await Promise.all([
                prisma.campaign.count({ where: { userId: m.userId, status: 'ACTIVE' } }),
                prisma.lead.count({ where: { userId: m.userId } }),
                prisma.actionLog.count({ where: { userId: m.userId, actionType: 'INVITE', status: 'SUCCESS', executedAt: { gte: today } } }),
                prisma.actionLog.count({ where: { userId: m.userId, actionType: 'MESSAGE', status: 'SUCCESS', executedAt: { gte: today } } }),
                prisma.lead.count({ where: { userId: m.userId, status: 'REPLIED' } }),
                prisma.user.findUnique({ where: { id: m.userId }, select: { proxyIp: true, dailyInviteLimit: true } }),
            ]);

            return {
                ...shapeMember(m),
                stats: {
                    activeCampaigns,
                    totalLeads,
                    invitesToday,
                    messagesToday,
                    totalReplies,
                    hasProxy: !!userRecord?.proxyIp,
                    dailyInviteLimit: userRecord?.dailyInviteLimit || 30,
                },
            };
        }));

        res.json({
            hasTeam: true,
            team: {
                id: team.id,
                name: team.name,
                ownerId: team.ownerId,
                tier: team.tier,
                seatsPurchased: team.seatsPurchased,
                maxSeats: Math.min(team.seatsPurchased, maxSeatsForTier(team.tier)),
                members: membersWithStats,
                invites: team.TeamInvite,
            },
            role: member.role,
        });
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({ error: 'Failed to fetch team' });
    }
};

// Create a new team
export const createTeam = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: 'Team name is required' });

    // Team collaboration is a Business feature. No-op unless ENFORCE_TIER_QUOTAS=1.
    if (!(await featureAllowed(userId, 'team'))) {
        return res.status(403).json({
            error: 'UPGRADE_REQUIRED',
            message: 'Team collaboration is available on the Business plan.',
        });
    }

    try {
        // Check if user already has a team
        const existingMember = await prisma.teamMember.findFirst({ where: { userId } });

        if (existingMember) {
            return res.status(400).json({ error: 'You are already in a team. Leave your current team to create a new one.' });
        }

        const team = await prisma.team.create({
            data: {
                name,
                ownerId: userId,
                TeamMember: {
                    create: { userId, role: 'OWNER' },
                },
            },
            include: {
                TeamMember: { include: { User: { select: { id: true, email: true } } } },
                TeamInvite: true,
            },
        });

        res.status(201).json({
            hasTeam: true,
            team: {
                id: team.id,
                name: team.name,
                ownerId: team.ownerId,
                tier: team.tier,
                seatsPurchased: team.seatsPurchased,
                maxSeats: Math.min(team.seatsPurchased, maxSeatsForTier(team.tier)),
                members: team.TeamMember.map(shapeMember),
                invites: team.TeamInvite,
            },
            role: 'OWNER',
        });
    } catch (error) {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
};

// Invite a member
export const inviteMember = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { teamId, email, role } = req.body;

    try {
        // Requester must be owner/admin of this team.
        const requester = await prisma.teamMember.findFirst({ where: { teamId, userId } });

        if (!requester || !canManageTeam(requester.role)) {
            return res.status(403).json({ error: 'Only owners and admins can invite members' });
        }

        // Check if user is already a member
        const existingMember = await prisma.user.findUnique({
            where: { email },
            include: { TeamMember: { where: { teamId } } },
        });

        if (existingMember && existingMember.TeamMember.length > 0) {
            return res.status(400).json({ error: 'User is already a member of this team' });
        }

        // Seat cap = the team's plan allowance (members + pending invites), NOT a
        // hardcoded constant. seatsPurchased may narrow it below the tier ceiling.
        const teamStatus = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                TeamMember: true,
                TeamInvite: { where: { status: 'PENDING' } },
            },
        });

        if (teamStatus) {
            const seatCap = Math.min(teamStatus.seatsPurchased, maxSeatsForTier(teamStatus.tier));
            if (teamStatus.TeamMember.length + teamStatus.TeamInvite.length >= seatCap) {
                return res.status(400).json({
                    error: `Your team is at capacity (${seatCap} seat${seatCap === 1 ? '' : 's'}). Add more seats to invite additional members.`,
                });
            }
        }

        // Never let an invite mint another OWNER — ownership transfer is separate.
        const inviteRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        await prisma.teamInvite.create({
            data: { teamId, email, role: inviteRole as any, token, expiresAt },
        });

        // Email the invite (best-effort — a mailer misconfig must not fail the
        // invite; the link is always returned so an admin can copy it manually).
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const inviteUrl = `${appUrl}/team/join?token=${token}`;
        let emailed = false;
        try {
            const info = await mailService.sendTeamInvite(email, {
                teamName: teamStatus?.name || 'your team',
                inviterEmail: req.user?.email,
                inviteUrl,
                role: inviteRole,
            });
            emailed = Boolean(info);
        } catch (mailErr: any) {
            console.error('[TEAM] invite email failed:', mailErr?.message || mailErr);
        }

        res.json({
            message: 'Invite created',
            inviteLink: `/team/join?token=${token}`,
            token,
            emailed,
        });
    } catch (error) {
        console.error('Error inviting member:', error);
        res.status(500).json({ error: 'Failed to invite member' });
    }
};

// Get invite info before joining
export const getInviteInfo = async (req: any, res: Response) => {
    const { token } = req.params;

    try {
        const invite = await prisma.teamInvite.findUnique({
            where: { token },
            include: { Team: true },
        });

        if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired invite token' });
        }

        res.json({
            teamName: invite.Team.name,
            role: invite.role,
            email: invite.email,
        });
    } catch (error) {
        console.error('Error fetching invite:', error);
        res.status(500).json({ error: 'Failed to fetch invite information' });
    }
};

// Join a team via invite token
export const joinTeam = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { token } = req.body;

    try {
        const invite = await prisma.teamInvite.findUnique({
            where: { token },
            include: { Team: true },
        });

        if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired invite token' });
        }

        // Check if user already in a team
        const existingMember = await prisma.teamMember.findFirst({ where: { userId } });

        if (existingMember) {
            return res.status(400).json({ error: 'You are already in a team. You must leave your current team first.' });
        }

        // Add user to team (never as OWNER — invites only mint MEMBER/ADMIN).
        await prisma.teamMember.create({
            data: {
                teamId: invite.teamId,
                userId,
                role: (invite.role === 'ADMIN' ? 'ADMIN' : 'MEMBER') as any,
            },
        });

        // Mark invite as accepted
        await prisma.teamInvite.update({
            where: { id: invite.id },
            data: { status: 'ACCEPTED' },
        });

        res.json({ success: true, teamName: invite.Team.name });
    } catch (error) {
        console.error('Error joining team:', error);
        res.status(500).json({ error: 'Failed to join team' });
    }
};

// Remove a member (or leave the team yourself)
export const removeMember = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { teamId, targetUserId } = req.params;

    try {
        const requester = await prisma.teamMember.findFirst({ where: { teamId, userId } });

        if (!requester) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const isSelf = userId === targetUserId;

        // Only owners/admins can remove other members; anyone can remove themselves.
        if (!isSelf && !canManageTeam(requester.role)) {
            return res.status(403).json({ error: 'Only owners and admins can remove other members' });
        }

        const team = await prisma.team.findUnique({ where: { id: teamId } });

        // The owner cannot be removed by anyone, and cannot leave, without first
        // transferring ownership — otherwise the team (and its subscription) would
        // be orphaned. Guard against the lock-out the old code left as a TODO.
        if (team?.ownerId === targetUserId) {
            return res.status(400).json({
                error: 'The team owner cannot be removed. Transfer ownership first, or delete the team.',
            });
        }

        await prisma.teamMember.delete({
            where: { teamId_userId: { teamId, userId: targetUserId } },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
};
