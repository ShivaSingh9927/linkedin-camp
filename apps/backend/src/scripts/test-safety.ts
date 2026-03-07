import { canWorkNow, applyJitter } from '../services/safety.service';
import { prisma } from '../server';

async function testSafety() {
    console.log('--- Testing Safety Engine ---');

    // 1. Test Working Hours
    const userId = 'e246a05b-c063-48d6-8dbc-26fe00628426';
    const status = await canWorkNow(userId);
    console.log('Work Status:', status);

    if (status.allowed) {
        console.log('✅ System can work right now.');
    } else {
        console.log('⏸ Outside working hours. Next start:', status.nextStartTime?.toISOString());
    }

    // 2. Test Jitter
    const baseline = new Date();
    const jittered = applyJitter(baseline, 60, 120);
    const diffMs = jittered.getTime() - baseline.getTime();
    console.log(`\nJitter Test (Baseline: ${baseline.toISOString()}):`);
    console.log(`Jittered: ${jittered.toISOString()}`);
    console.log(`Added Delay: ${Math.round(diffMs / 1000 / 60)} minutes`);

    process.exit(0);
}

testSafety().catch(err => {
    console.error(err);
    process.exit(1);
});
