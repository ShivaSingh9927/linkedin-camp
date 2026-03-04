import { Response } from 'express';
import { prisma } from '@repo/db';
import crypto from 'crypto';

// Get current user's team
export const getMyTeam = async (req: any, res: Response) => {
    const userId = req.user.id;

    try {
        // Find the team member entry for this user
        const member = await prisma.teamMember.findFirst({
            where: { userId },
            include: {
                team: {
                    include: {
                        members: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        email: true,
                                    }
                                }
                            }
                        },
                        invites: {
                            where: { status: 'PENDING' }
                        }
                    }
                }
            }
        });

        if (!member) {
            return res.json({ hasTeam: false });
        }

        // Fetch statistics for members if user is Admin (or for everyone for a cooler UI)
        const membersWithStats = await Promise.all(member.team.members.map(async (m) => {
            const activeCampaigns = await prisma.campaign.count({
                where: { userId: m.userId, status: 'ACTIVE' }
            });
            const totalLeads = await prisma.lead.count({
                where: { userId: m.userId }
            });
            return {
                ...m,
                stats: {
                    activeCampaigns,
                    totalLeads,
                }
            };
        }));

        res.json({
            hasTeam: true,
            team: {
                ...member.team,
                members: membersWithStats
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

    try {
        // Check if user already has a team
        const existingMember = await prisma.teamMember.findFirst({
            where: { userId }
        });

        if (existingMember) {
            return res.status(400).json({ error: 'You are already in a team. Leave your current team to create a new one.' });
        }

        const team = await prisma.team.create({
            data: {
                name,
                ownerId: userId,
                members: {
                    create: {
                        userId,
                        role: 'ADMIN'
                    }
                }
            },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, email: true } }
                    }
                },
                invites: true
            }
        });

        res.status(201).json({
            hasTeam: true,
            team,
            role: 'ADMIN'
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
        // Check if requester is Admin
        const adminMember = await prisma.teamMember.findFirst({
            where: { teamId, userId, role: 'ADMIN' }
        });

        if (!adminMember) {
            return res.status(403).json({ error: 'Only admins can invite members' });
        }

        // Check if user is already a member
        const existingMember = await prisma.user.findUnique({
            where: { email },
            include: { teamMembers: { where: { teamId } } }
        });

        if (existingMember && existingMember.teamMembers.length > 0) {
            return res.status(400).json({ error: 'User is already a member of this team' });
        }

        // Enforce 10 Member Capacity Limit (Members + Pending Invites)
        const teamStatus = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                members: true,
                invites: { where: { status: 'PENDING' } }
            }
        });

        if (teamStatus && (teamStatus.members.length + teamStatus.invites.length >= 10)) {
            return res.status(400).json({ error: 'Crew is at maximum capacity (10 seats). Please upgrade your plan to invite more.' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        const invite = await prisma.teamInvite.create({
            data: {
                teamId,
                email,
                role: (role || 'MEMBER') as any,
                token,
                expiresAt,
            }
        });

        // In a real app, send email. Return relative link for demo.
        res.json({
            message: 'Invite created',
            inviteLink: `/team/join?token=${token}`,
            token
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
            include: { team: true }
        });

        if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired invite token' });
        }

        res.json({
            teamName: invite.team.name,
            role: invite.role,
            email: invite.email
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
            include: { team: true }
        });

        if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired invite token' });
        }

        // Check if user already in a team
        const existingMember = await prisma.teamMember.findFirst({
            where: { userId }
        });

        if (existingMember) {
            return res.status(400).json({ error: 'You are already in a team. You must leave your current team first.' });
        }

        // Add user to team
        await prisma.teamMember.create({
            data: {
                teamId: invite.teamId,
                userId,
                role: invite.role as any
            }
        });

        // Mark invite as accepted
        await prisma.teamInvite.update({
            where: { id: invite.id },
            data: { status: 'ACCEPTED' }
        });

        res.json({ success: true, teamName: invite.team.name });
    } catch (error) {
        console.error('Error joining team:', error);
        res.status(500).json({ error: 'Failed to join team' });
    }
};

// Remove a member
export const removeMember = async (req: any, res: Response) => {
    const userId = req.user.id;
    const { teamId, targetUserId } = req.params;

    try {
        const adminMember = await prisma.teamMember.findFirst({
            where: { teamId, userId }
        });

        if (!adminMember) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        // Only admins can remove other members, or a user can remove themselves
        if (adminMember.role !== 'ADMIN' && userId !== targetUserId) {
            return res.status(403).json({ error: 'Only admins can remove other members' });
        }

        // If target is Admin AND owner, cannot remove (must transfer ownership first - simpler in Phase 1: can't remove self if owner)
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (team?.ownerId === targetUserId && userId === targetUserId) {
            // Let's just allow it for now, user can always recreate. But ideally prevent lock-out.
        }

        await prisma.teamMember.delete({
            where: {
                teamId_userId: {
                    teamId,
                    userId: targetUserId
                }
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
};
