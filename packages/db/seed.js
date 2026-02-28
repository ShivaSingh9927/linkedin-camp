const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Manually extract DATABASE_URL from .env if needed, but assuming process.env is populated by caller
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

async function main() {
    console.log('Using DB URL:', process.env.DATABASE_URL);
    const passwordHash = await bcrypt.hash('password123', 10);

    const user = await prisma.user.upsert({
        where: { email: 'test@example.com' },
        update: {},
        create: {
            email: 'test@example.com',
            passwordHash,
            tier: 'PRO',
        },
    });

    console.log('User created:', user.email);
    // ... rest same as before
}

main()
    .catch((e) => {
        console.error('Seed Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
