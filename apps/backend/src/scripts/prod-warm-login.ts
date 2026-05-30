// One-shot script: log a single LinkedIn account into the live prod DB
// using loginWithOtp() so the session is persisted the official way.
//
// Run inside the backend container so the dISP and Playwright are available:
//   docker exec backend-api node -e "process.argv=[...]; require('./dist/scripts/prod-warm-login.js')"
//
// ENV inputs:
//   QUSER_ID   — Qampi User.id to write the session onto
//   QEMAIL     — LinkedIn login email
//   QPASSWORD  — LinkedIn password
//   QPROXY_S   — proxy host:port (e.g. "82.41.252.111:46222")
//   QPROXY_U / QPROXY_P — proxy creds
//   QOTP_FILE  — (optional) path to poll for an OTP code; default /tmp/otp_code_<userId>
//
// On OTP prompt: the script logs "OTP_REQUIRED requestId=<userId>" and waits
// up to 10 minutes for the code to be written to QOTP_FILE. This lets a
// human paste a code from email without an interactive shell.

import * as fs from 'fs';
import { loginWithOtp } from '../services/login-with-otp.service';
import type { OtpResolver } from '../services/login-with-otp.service';

function filePollResolver(path: string, timeoutMs = 600_000): OtpResolver {
    return async (_attempt: number) => {
        const deadline = Date.now() + timeoutMs;
        try { fs.unlinkSync(path); } catch {}
        console.log(`[warm-login] OTP_REQUIRED — write code to ${path}`);
        while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 2000));
            if (fs.existsSync(path)) {
                const code = fs.readFileSync(path, 'utf8').trim();
                if (code) {
                    try { fs.unlinkSync(path); } catch {}
                    return code;
                }
            }
        }
        throw new Error(`OTP file ${path} not provided within timeout`);
    };
}

async function main() {
    const userId   = process.env.QUSER_ID!;
    const email    = process.env.QEMAIL!;
    const password = process.env.QPASSWORD!;
    const proxyS   = process.env.QPROXY_S!;
    const proxyU   = process.env.QPROXY_U!;
    const proxyP   = process.env.QPROXY_P!;
    const otpFile  = process.env.QOTP_FILE || `/tmp/otp_code_${userId}`;

    if (!userId || !email || !password || !proxyS) {
        console.error('Missing required env: QUSER_ID, QEMAIL, QPASSWORD, QPROXY_S');
        process.exit(2);
    }

    console.log(`[warm-login] userId=${userId} email=${email} proxy=${proxyS}`);

    const outcome = await loginWithOtp({
        userId,
        email,
        password,
        proxy: { server: `http://${proxyS}`, username: proxyU, password: proxyP },
        otpResolver: filePollResolver(otpFile),
    });

    console.log(`[warm-login] outcome=${JSON.stringify(outcome)}`);
    process.exit(outcome.kind === 'success' ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
