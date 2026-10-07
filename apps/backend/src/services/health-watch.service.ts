// Notice things going wrong without anyone looking.
//
// Every defect found in the week of 2026-09-29 — three nodes reporting success
// for work that never happened, a reply that never reached the database, a
// five-day wait collapsing to 78 seconds — was found because somebody went
// looking. Nothing watches. A campaign that starts failing at 3am on a Saturday
// stays invisible until a human asks the right question.
//
// This checks a small number of conditions that have actually bitten, and files
// an in-app Notification per user. Deliberately narrow: an alert nobody trusts
// is worse than none, so every check here answers "something is wrong RIGHT NOW
// and a person must act", not "a thing failed once".

import { prisma } from '@repo/db';

export interface HealthFinding {
    key: string;            // stable, so repeats can be suppressed
    title: string;
    body: string;
    type: 'WARNING' | 'ERROR';
}

/** Don't re-file the same unread finding; a repeated alarm is noise. */
async function fileFinding(userId: string, f: HealthFinding): Promise<boolean> {
    const existing = await prisma.notification.findFirst({
        where: {
            userId,
            read: false,
            title: f.title,
            createdAt: { gt: new Date(Date.now() - 12 * 3600 * 1000) },
        },
        select: { id: true },
    });
    if (existing) return false;
    await prisma.notification.create({
        data: { userId, title: f.title, body: f.body, type: f.type, meta: { key: f.key, source: 'health-watch' } },
    });
    console.warn(`[HEALTH] ${f.type} for ${userId}: ${f.title} — ${f.body}`);
    return true;
}

export async function runHealthWatch(): Promise<{ checked: number; filed: number }> {
    const users = await prisma.user.findMany({
        select: { id: true, accountHealth: true, sessionInvalid: true, proxyId: true },
    });

    let filed = 0;
    for (const u of users) {
        const findings: HealthFinding[] = [];

        // 1. The account cannot act at all. Everything else is moot.
        const blocked = !!u.sessionInvalid || u.accountHealth === 'NEEDS_LOGIN';
        if (blocked) {
            findings.push({
                key: 'session',
                title: 'LinkedIn session needs attention',
                body: 'Campaigns cannot run until this account signs in to LinkedIn again.',
                type: 'ERROR',
            });
        }

        // 2. The assigned proxy is down. Seen 2026-10-06: 68 consecutive
        //    failures with nothing surfaced, and every action for that account
        //    failing in a way that looked like a LinkedIn problem.
        if (u.proxyId) {
            // failureCount is the only health signal on this model; the health
            // worker resets it to 0 on a successful check and increments on
            // failure. Five consecutive is well past a transient blip and far
            // short of the 68 that went unnoticed.
            const proxy = await prisma.proxy.findUnique({
                where: { id: u.proxyId },
                select: { proxyIp: true, failureCount: true },
            }).catch(() => null);
            if (proxy && (proxy.failureCount || 0) >= 5) {
                findings.push({
                    key: 'proxy',
                    title: 'Proxy is not reachable',
                    body: `All LinkedIn activity for this account routes through ${proxy.proxyIp}, which has failed ${proxy.failureCount} consecutive health checks. Nothing will run until it recovers.`,
                    type: 'ERROR',
                });
            }
        }

        // 3. An ACTIVE campaign whose work is overdue. The scheduler runs every
        //    minute, so anything more than two hours late means it is not being
        //    picked up — a real stall, not pacing.
        //
        //    Skipped when the account is blocked: a campaign cannot progress
        //    without a session, so reporting it separately is a second alarm
        //    for one cause. On the first run this filed "Invite-and-Follow
        //    Hedge is not progressing" for an account whose session had been
        //    invalid for 25 days — true, and useless next to the session alert
        //    that already named the reason.
        const active = blocked ? [] : await prisma.campaign.findMany({
            where: { userId: u.id, status: 'ACTIVE' },
            select: { id: true, name: true },
        });
        for (const c of active) {
            const overdue = await prisma.campaignLead.count({
                where: {
                    campaignId: c.id,
                    isCompleted: false,
                    nextActionDate: { lt: new Date(Date.now() - 2 * 3600 * 1000) },
                },
            });
            if (overdue > 0) {
                findings.push({
                    key: `stalled:${c.id}`,
                    title: `"${c.name}" is not progressing`,
                    body: `${overdue} lead(s) have been due for more than two hours. The scheduler runs every minute, so this is a stall rather than pacing.`,
                    type: 'ERROR',
                });
            }
        }

        // 4. A burst of failures in the last hour. Set high enough that one bad
        //    profile cannot trigger it — this is for "the node is broken", which
        //    is what three separate nodes silently were.
        //    Also skipped while blocked — every action failing because there is
        //    no session is the session's finding, not a node-health one.
        const since = new Date(Date.now() - 3600 * 1000);
        const recent = blocked ? [] : await prisma.actionLog.groupBy({
            by: ['status'],
            where: { userId: u.id, executedAt: { gt: since } },
            _count: { _all: true },
        });
        const ok = recent.find((r) => r.status === 'SUCCESS')?._count._all || 0;
        const bad = recent.find((r) => r.status === 'FAILED')?._count._all || 0;
        if (bad >= 5 && bad > ok) {
            const worst = await prisma.actionLog.groupBy({
                by: ['actionType'],
                where: { userId: u.id, status: 'FAILED', executedAt: { gt: since } },
                _count: { _all: true },
                orderBy: { _count: { actionType: 'desc' } },
                take: 1,
            }).catch(() => []);
            findings.push({
                key: 'failure-rate',
                title: 'Actions are failing more often than succeeding',
                body: `${bad} failed and ${ok} succeeded in the last hour`
                    + (worst[0] ? `, mostly ${worst[0].actionType}` : '') + '.',
                type: 'WARNING',
            });
        }

        // 5. Leads parked in a campaign that will never run again. They are not
        //    failed and not finished, so nothing lists them: 13 were sitting
        //    like this when the system was swept on 2026-10-07.
        const deferred = await prisma.campaignLeadProgress.findMany({
            where: { status: 'DEFERRED', Campaign: { userId: u.id, status: { not: 'ACTIVE' } } },
            select: { id: true },
        }).catch(() => []);
        if (deferred.length >= 5) {
            findings.push({
                key: 'orphan-deferred',
                title: `${deferred.length} leads are waiting in campaigns that are not running`,
                body: 'They are paused mid-sequence and will never resume unless their campaign is started again.',
                type: 'WARNING',
            });
        }

        for (const f of findings) {
            if (await fileFinding(u.id, f)) filed++;
        }
    }

    return { checked: users.length, filed };
}
