import { cloudLoginService } from '../services/cloud-login.service';
import { prisma } from '@repo/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function test() {
    const email = "rajaji98971@gmail.com";
    const pass = "Hue#35op";
    const userId = "test-user-id"; // We can use a dummy or find a real one

    console.log(`[TEST] Starting cloud login test for ${email}...`);

    try {
        // Mocking the user in DB if it doesn't exist
        const user = await prisma.user.upsert({
            where: { email: "test@example.com" },
            update: { id: userId, tier: 'ULTIMATE' },
            create: {
                id: userId,
                email: "test@example.com",
                firstName: "Test User",
                passwordHash: "hashed_password",
                tier: 'ULTIMATE'
            }
        });

        const result = await cloudLoginService.startLogin(userId, email, pass);
         
        if ('success' in result && result.success === true) {
            console.log("--------------------------------------------------");
            console.log("SUCCESS: Logged in directly without 2FA!");
            console.log("--------------------------------------------------");
        } else if ('requires2FA' in result && result.requires2FA === true) {
            console.log("--------------------------------------------------");
            console.log("SUCCESS: Security Challenge Detected!");
            console.log("LinkedIn is asking for a 2FA code.");
            console.log("This proves the Cloud Login Relay is working.");
            console.log("--------------------------------------------------");
        } else {
            console.log("--------------------------------------------------");
            console.log("FAILED:", result.error);
            console.log("--------------------------------------------------");
        }
    } catch (err: any) {
        console.error("[TEST] Error:", err.message);
    } finally {
        process.exit(0);
    }
}

test();
