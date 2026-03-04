const { PrismaClient } = require('@repo/db');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// A script to test the Ghosting API Functionality
const testGhosting = async () => {
    try {
        console.log('--- Establishing Ghosting Test ---');

        // Create an admin token (substitute with valid test ID)
        const adminId = 'e246a05b-c063-48d6-8dbc-26fe00628426'; // e2e-test admin
        const adminToken = jwt.sign({ id: adminId, email: 'admin@test.com' }, 'super-secret-key-123', { expiresIn: '7d' });

        // Seed data if missing
        console.log('--- Bootstrapping Database State ---');
        let adminUser = await prisma.user.findUnique({ where: { id: adminId } });
        if (!adminUser) {
            adminUser = await prisma.user.create({ data: { id: adminId, email: 'admin@test.com', passwordHash: 'hash' } });
        }

        let adminMember = await prisma.teamMember.findFirst({ where: { userId: adminId } });
        if (!adminMember) {
            const team = await prisma.team.create({
                data: {
                    name: 'Test Ghosting Crew',
                    ownerId: adminId,
                    members: { create: { userId: adminId, role: 'ADMIN' } }
                }
            });
            adminMember = await prisma.teamMember.findFirst({ where: { userId: adminId } });
        }

        const teamId = adminMember.teamId;

        const ghostId = 'ghost-user-123';
        let ghostUser = await prisma.user.findUnique({ where: { id: ghostId } });
        if (!ghostUser) {
            ghostUser = await prisma.user.create({ data: { id: ghostId, email: 'ghost@test.com', passwordHash: 'hash' } });
            await prisma.teamMember.create({ data: { teamId, userId: ghostId, role: 'MEMBER' } });
        }

        // Let's assume we want to query the /api/v1/team endpoint. 
        // 1. Without Ghosting (As Admin)
        console.log('\n[1] Fetching Crew without Target User (Me)');
        const res1 = await axios.get('http://localhost:3001/api/v1/team', {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('Response Status:', res1.status);
        if (res1.data.team) {
            console.log('Crew Name:', res1.data.team.name);
            console.log('Members:', res1.data.team.members.map((m: any) => m.user.email));

            // Find a member to ghost
            const ghostMember = res1.data.team.members.find((m: any) => m.userId !== adminId);

            if (ghostMember) {
                console.log(`\n[2] Ghosting as Member: ${ghostMember.user.email} (${ghostMember.userId})`);

                // Let's fetch the team again, but explicitly as this ghost user
                // (Note: This is just fetching the team as that user, effectively proving we assumed their identity)
                const res2 = await axios.get('http://localhost:3001/api/v1/team', {
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'X-Operating-User-Id': ghostMember.userId
                    }
                });
                console.log('Ghosting Response Status:', res2.status);
                console.log('Ghosting Identity Provided:', res2.data.role); // Role of the ghosted user

                // Also fetch their leads specifically
                console.log('\n[3] Fetching Leads while Ghosting');
                const res3 = await axios.get('http://localhost:3001/api/v1/leads', {
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'X-Operating-User-Id': ghostMember.userId
                    }
                });
                console.log('Leads fetched for ghost user:', res3.data.length);
            } else {
                console.log('\nCannot test ghosting: No other members in the team.');
            }
        } else {
            console.log('Admin is not in a team.');
        }

    } catch (e) {
        if (e.response) {
            console.error('API Error:', e.response.status, e.response.data);
        } else {
            console.error('Network Error:', e.message);
        }
    }
};

testGhosting();
