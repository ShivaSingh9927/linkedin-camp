import { TemplateNode, TemplateEdge } from './types';
import { node, edge } from './helpers';

// Shape builders — composable workflow primitives.
// Every shape that DMs leads inserts a CHECK_CONNECTION + IF_ELSE gate so the
// engine refuses to send into a 3rd-degree void. Gate-correctness by construction.

export interface WorkflowShape {
    nodes: TemplateNode[];
    edges: TemplateEdge[];
}

type Y = number;
const Y_STEP = 100;

const trueEdge = (s: string, t: string): TemplateEdge => ({ ...edge(s, t), sourceHandle: 'true' });
const falseEdge = (s: string, t: string): TemplateEdge => ({ ...edge(s, t), sourceHandle: 'false' });

const gateCondition = {
    condition: {
        source: 'connectionState' as const,
        field: 'connected',
        operator: 'is_true',
        probeOnNull: true,
    },
};

// ────────────────────────────────────────────────────────────────────────────
// 1. coldInvite — visit → wait → connect → wait → gate → message(s) [+ followups]
// Use when: 2nd/3rd-degree prospecting. Goal is to open a 1:1 conversation.
// ────────────────────────────────────────────────────────────────────────────
export function coldInvite(opts: {
    beforeConnectDays: number;
    afterAcceptDays: number;
    betweenMsgsDays: number;
    messageCount: 1 | 2 | 3 | 4;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
            enrichCompany: true, enrichAbout: true,
        }),
        node('n2', 2 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.beforeConnectDays}d`, { delayDays: opts.beforeConnectDays }),
        node('n3', 3 * Y_STEP, 'ACTION', 'CONNECT', 'Send Invite (AI note)', { aiEnabled: true, message: '' }),
        node('n4', 4 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.afterAcceptDays}d`, { delayDays: opts.afterAcceptDays }),
        node('n5', 5 * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Confirm Accepted'),
        node('n6', 6 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Connected?', gateCondition),
        node('n7', 7 * Y_STEP, 'ACTION', 'MESSAGE', 'Welcome Message (AI)', { aiEnabled: true, message: '' }),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'),
        edge('n3', 'n4'), edge('n4', 'n5'), edge('n5', 'n6'),
        trueEdge('n6', 'n7'),
    ];
    let cursor = 'n7'; let yi = 8;
    for (let m = 2; m <= opts.messageCount; m++) {
        const waitId = `w${m}`, msgId = `m${m}`;
        nodes.push(node(waitId, yi++ * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenMsgsDays}d`, { delayDays: opts.betweenMsgsDays }));
        nodes.push(node(msgId, yi++ * Y_STEP, 'ACTION', 'MESSAGE', `Follow-up ${m - 1} (AI)`, { aiEnabled: true, message: '' }));
        edges.push(edge(cursor, waitId), edge(waitId, msgId));
        cursor = msgId;
    }
    nodes.push(node('end_ok', yi * Y_STEP, 'ACTION', 'END', 'End'));
    nodes.push(node('end_no', (yi + 1) * Y_STEP, 'ACTION', 'END', 'Not Accepted'));
    edges.push(edge(cursor, 'end_ok'), falseEdge('n6', 'end_no'));
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. warmDM — gate → message(s). Use when: 1st-degree only (reactivation,
// referrals, past clients). Gate still runs in case the lead was misclassified.
// ────────────────────────────────────────────────────────────────────────────
export function warmDM(opts: {
    beforeFirstMsgDays: number;
    betweenMsgsDays: number;
    messageCount: 1 | 2 | 3;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', { enrichAbout: true }),
        node('n2', 2 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.beforeFirstMsgDays}d`, { delayDays: opts.beforeFirstMsgDays }),
        node('n3', 3 * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Confirm Connected'),
        node('n4', 4 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Connected?', gateCondition),
        node('n5', 5 * Y_STEP, 'ACTION', 'MESSAGE', 'Open Message (AI)', { aiEnabled: true, message: '' }),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n4'),
        trueEdge('n4', 'n5'),
    ];
    let cursor = 'n5'; let yi = 6;
    for (let m = 2; m <= opts.messageCount; m++) {
        const waitId = `w${m}`, msgId = `m${m}`;
        nodes.push(node(waitId, yi++ * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenMsgsDays}d`, { delayDays: opts.betweenMsgsDays }));
        nodes.push(node(msgId, yi++ * Y_STEP, 'ACTION', 'MESSAGE', `Follow-up ${m - 1} (AI)`, { aiEnabled: true, message: '' }));
        edges.push(edge(cursor, waitId), edge(waitId, msgId));
        cursor = msgId;
    }
    nodes.push(node('end_ok', yi * Y_STEP, 'ACTION', 'END', 'End'));
    nodes.push(node('end_no', (yi + 1) * Y_STEP, 'ACTION', 'END', 'Not 1st-degree'));
    edges.push(edge(cursor, 'end_ok'), falseEdge('n4', 'end_no'));
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. engageThenInvite — like + comment first, then connect. Higher accept rate
// because the lead has seen you before the invite lands.
// ────────────────────────────────────────────────────────────────────────────
export function engageThenInvite(opts: {
    beforeConnectDays: number;
    afterAcceptDays: number;
    withMessage: boolean;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', { enrichPosts: true }),
        node('n2', 2 * Y_STEP, 'ACTION', 'LIKE', 'Like Recent Post'),
        node('n3', 3 * Y_STEP, 'ACTION', 'COMMENT', 'Comment on Post (AI)', { aiEnabled: true }),
        node('n4', 4 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.beforeConnectDays}d`, { delayDays: opts.beforeConnectDays }),
        node('n5', 5 * Y_STEP, 'ACTION', 'CONNECT', 'Send Invite (AI note)', { aiEnabled: true, message: '' }),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'),
        edge('n3', 'n4'), edge('n4', 'n5'),
    ];
    if (opts.withMessage) {
        nodes.push(
            node('n6', 6 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.afterAcceptDays}d`, { delayDays: opts.afterAcceptDays }),
            node('n7', 7 * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Confirm Accepted'),
            node('n8', 8 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Connected?', gateCondition),
            node('n9', 9 * Y_STEP, 'ACTION', 'MESSAGE', 'Welcome Message (AI)', { aiEnabled: true, message: '' }),
            node('end_ok', 10 * Y_STEP, 'ACTION', 'END', 'End'),
            node('end_no', 11 * Y_STEP, 'ACTION', 'END', 'Not Accepted'),
        );
        edges.push(
            edge('n5', 'n6'), edge('n6', 'n7'), edge('n7', 'n8'),
            trueEdge('n8', 'n9'), edge('n9', 'end_ok'), falseEdge('n8', 'end_no'),
        );
    } else {
        nodes.push(node('end_ok', 6 * Y_STEP, 'ACTION', 'END', 'End'));
        edges.push(edge('n5', 'end_ok'));
    }
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. followAndNurture — follow + engage loop, no DM. Brand presence / audience
// build. Safe across any degree because nothing here requires a connection.
// ────────────────────────────────────────────────────────────────────────────
export function followAndNurture(opts: {
    betweenEngageDays: number;
    engageRounds: 1 | 2 | 3;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile'),
        node('n2', 2 * Y_STEP, 'ACTION', 'FOLLOW', 'Follow'),
    ];
    const edges: TemplateEdge[] = [edge('trigger', 'n1'), edge('n1', 'n2')];
    let cursor = 'n2'; let yi = 3;
    for (let r = 1; r <= opts.engageRounds; r++) {
        const waitId = `rw${r}`, likeId = `rl${r}`, comId = `rc${r}`;
        nodes.push(
            node(waitId, yi++ * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenEngageDays}d`, { delayDays: opts.betweenEngageDays }),
            node(likeId, yi++ * Y_STEP, 'ACTION', 'LIKE', `Like Post (round ${r})`),
            node(comId, yi++ * Y_STEP, 'ACTION', 'COMMENT', `Comment (AI, round ${r})`, { aiEnabled: true }),
        );
        edges.push(edge(cursor, waitId), edge(waitId, likeId), edge(likeId, comId));
        cursor = comId;
    }
    nodes.push(node('end_ok', yi * Y_STEP, 'ACTION', 'END', 'End'));
    edges.push(edge(cursor, 'end_ok'));
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. emailFirst — email_finder → email; optional LinkedIn echo. Use when the
// user already has a 1st-degree list or values email primary.
// ────────────────────────────────────────────────────────────────────────────
export function emailFirst(opts: {
    afterEmailDays: number;
    withLinkedInEcho: boolean;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', { enrichCompany: true, enrichContact: true }),
        node('n2', 2 * Y_STEP, 'ACTION', 'EMAIL_FINDER', 'Find Email'),
        node('n3', 3 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Email Found?', {
            condition: { source: 'storedOutputs', field: 'email-finder.email', operator: 'is_not_null' },
        }),
        node('n4', 4 * Y_STEP, 'ACTION', 'EMAIL', 'Send Email (AI)', { aiEnabled: true }),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'),
        trueEdge('n3', 'n4'),
    ];
    if (opts.withLinkedInEcho) {
        nodes.push(
            node('n5', 5 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.afterEmailDays}d`, { delayDays: opts.afterEmailDays }),
            node('n6', 6 * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Check Connection'),
            node('n7', 7 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Connected?', gateCondition),
            node('n8', 8 * Y_STEP, 'ACTION', 'MESSAGE', 'LinkedIn Echo (AI)', { aiEnabled: true, message: '' }),
            node('end_ok', 9 * Y_STEP, 'ACTION', 'END', 'End'),
            node('end_skip', 10 * Y_STEP, 'ACTION', 'END', 'Email-only'),
        );
        edges.push(
            edge('n4', 'n5'), edge('n5', 'n6'), edge('n6', 'n7'),
            trueEdge('n7', 'n8'), edge('n8', 'end_ok'),
            falseEdge('n7', 'end_skip'), falseEdge('n3', 'end_skip'),
        );
    } else {
        nodes.push(node('end_ok', 5 * Y_STEP, 'ACTION', 'END', 'End'));
        edges.push(edge('n4', 'end_ok'), falseEdge('n3', 'end_ok'));
    }
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 6. multiChannelDrip — connect → gate → message → wait → email_finder → email.
// LinkedIn first (highest signal), email as fallback when LI doesn't respond.
// ────────────────────────────────────────────────────────────────────────────
export function multiChannelDrip(opts: {
    beforeConnectDays: number;
    afterAcceptDays: number;
    beforeEmailDays: number;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
            enrichCompany: true, enrichAbout: true, enrichContact: true,
        }),
        node('n2', 2 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.beforeConnectDays}d`, { delayDays: opts.beforeConnectDays }),
        node('n3', 3 * Y_STEP, 'ACTION', 'CONNECT', 'Send Invite (AI note)', { aiEnabled: true, message: '' }),
        node('n4', 4 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.afterAcceptDays}d`, { delayDays: opts.afterAcceptDays }),
        node('n5', 5 * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Check Connection'),
        node('n6', 6 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Connected?', gateCondition),
        node('n7', 7 * Y_STEP, 'ACTION', 'MESSAGE', 'LinkedIn Open (AI)', { aiEnabled: true, message: '' }),
        node('n8', 8 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.beforeEmailDays}d`, { delayDays: opts.beforeEmailDays }),
        node('n9', 9 * Y_STEP, 'ACTION', 'EMAIL_FINDER', 'Find Email'),
        node('n10', 10 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Email Found?', {
            condition: { source: 'storedOutputs', field: 'email-finder.email', operator: 'is_not_null' },
        }),
        node('n11', 11 * Y_STEP, 'ACTION', 'EMAIL', 'Send Email (AI)', { aiEnabled: true }),
        node('end_ok', 12 * Y_STEP, 'ACTION', 'END', 'End'),
        node('end_no', 13 * Y_STEP, 'ACTION', 'END', 'Stop'),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'),
        edge('n3', 'n4'), edge('n4', 'n5'), edge('n5', 'n6'),
        trueEdge('n6', 'n7'), falseEdge('n6', 'n9'),
        edge('n7', 'n8'), edge('n8', 'n9'), edge('n9', 'n10'),
        trueEdge('n10', 'n11'), falseEdge('n10', 'end_no'),
        edge('n11', 'end_ok'),
    ];
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 7. reactivation — 1st-degree dormant re-engagement. Variant of warmDM that
// leads with a profile visit + like before the open message.
// ────────────────────────────────────────────────────────────────────────────
export function reactivation(opts: {
    beforeFirstMsgDays: number;
    betweenMsgsDays: number;
    messageCount: 1 | 2;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', { enrichAbout: true, enrichPosts: true }),
        node('n2', 2 * Y_STEP, 'ACTION', 'LIKE', 'Like Recent Post'),
        node('n3', 3 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.beforeFirstMsgDays}d`, { delayDays: opts.beforeFirstMsgDays }),
        node('n4', 4 * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Confirm Still Connected'),
        node('n5', 5 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Connected?', gateCondition),
        node('n6', 6 * Y_STEP, 'ACTION', 'MESSAGE', 'Reconnect Message (AI)', { aiEnabled: true, message: '' }),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'),
        edge('n3', 'n4'), edge('n4', 'n5'),
        trueEdge('n5', 'n6'),
    ];
    let cursor = 'n6'; let yi = 7;
    if (opts.messageCount >= 2) {
        nodes.push(
            node('w2', yi++ * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenMsgsDays}d`, { delayDays: opts.betweenMsgsDays }),
            node('m2', yi++ * Y_STEP, 'ACTION', 'MESSAGE', 'Follow-up (AI)', { aiEnabled: true, message: '' }),
        );
        edges.push(edge(cursor, 'w2'), edge('w2', 'm2'));
        cursor = 'm2';
    }
    nodes.push(node('end_ok', yi * Y_STEP, 'ACTION', 'END', 'End'));
    nodes.push(node('end_no', (yi + 1) * Y_STEP, 'ACTION', 'END', 'No longer connected'));
    edges.push(edge(cursor, 'end_ok'), falseEdge('n5', 'end_no'));
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 8. multiLikePresence — N LIKEs on different posts (postIndex 0..N-1) with
// gaps. No comments, no DMs. Pure passive presence — lead sees your name in
// notifications N times. Safe on any degree.
// ────────────────────────────────────────────────────────────────────────────
export function multiLikePresence(opts: {
    likeCount: 2 | 3 | 4;
    betweenLikesDays: number;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', { enrichPosts: true }),
    ];
    const edges: TemplateEdge[] = [edge('trigger', 'n1')];
    let cursor = 'n1'; let yi = 2;
    for (let i = 0; i < opts.likeCount; i++) {
        const likeId = `lk${i}`;
        nodes.push(node(likeId, yi++ * Y_STEP, 'ACTION', 'LIKE', `Like Post #${i + 1}`, { postIndex: i }));
        edges.push(edge(cursor, likeId));
        cursor = likeId;
        if (i < opts.likeCount - 1) {
            const waitId = `lw${i}`;
            nodes.push(node(waitId, yi++ * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenLikesDays}d`, { delayDays: opts.betweenLikesDays }));
            edges.push(edge(cursor, waitId));
            cursor = waitId;
        }
    }
    nodes.push(node('end_ok', yi * Y_STEP, 'ACTION', 'END', 'End'));
    edges.push(edge(cursor, 'end_ok'));
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 9. commentLadderColdInvite — N substantive COMMENTs on different posts
// spaced over time, THEN the CONNECT lands warm. The mechanic is escalating
// familiarity: each comment is itself a visible, AI-personalized touch.
// ────────────────────────────────────────────────────────────────────────────
export function commentLadderColdInvite(opts: {
    commentCount: 2 | 3;
    betweenCommentsDays: number;
    afterAcceptDays: number;
    withMessage: boolean;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', { enrichPosts: true }),
    ];
    const edges: TemplateEdge[] = [edge('trigger', 'n1')];
    let cursor = 'n1'; let yi = 2;
    for (let i = 0; i < opts.commentCount; i++) {
        const comId = `cm${i}`;
        nodes.push(node(comId, yi++ * Y_STEP, 'ACTION', 'COMMENT', `Comment on Post #${i + 1} (AI)`, { aiEnabled: true, postIndex: i }));
        edges.push(edge(cursor, comId));
        cursor = comId;
        if (i < opts.commentCount - 1) {
            const waitId = `cw${i}`;
            nodes.push(node(waitId, yi++ * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenCommentsDays}d`, { delayDays: opts.betweenCommentsDays }));
            edges.push(edge(cursor, waitId));
            cursor = waitId;
        }
    }
    // After the ladder, send the invite
    const inviteId = 'inv';
    nodes.push(node(inviteId, yi++ * Y_STEP, 'ACTION', 'CONNECT', 'Send Invite (AI note)', { aiEnabled: true, message: '' }));
    edges.push(edge(cursor, inviteId));
    cursor = inviteId;
    if (opts.withMessage) {
        nodes.push(
            node('w_acc', yi++ * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.afterAcceptDays}d`, { delayDays: opts.afterAcceptDays }),
            node('cc', yi++ * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Confirm Accepted'),
            node('gate', yi++ * Y_STEP, 'CONDITION', 'IF_ELSE', 'Connected?', gateCondition),
            node('msg', yi++ * Y_STEP, 'ACTION', 'MESSAGE', 'Welcome Message (AI)', { aiEnabled: true, message: '' }),
            node('end_ok', yi++ * Y_STEP, 'ACTION', 'END', 'End'),
            node('end_no', yi * Y_STEP, 'ACTION', 'END', 'Not Accepted'),
        );
        edges.push(
            edge(cursor, 'w_acc'), edge('w_acc', 'cc'), edge('cc', 'gate'),
            trueEdge('gate', 'msg'), edge('msg', 'end_ok'),
            falseEdge('gate', 'end_no'),
        );
    } else {
        nodes.push(node('end_ok', yi * Y_STEP, 'ACTION', 'END', 'End'));
        edges.push(edge(cursor, 'end_ok'));
    }
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 10. smartAudienceRouter — single template handling mixed lists. Top-level
// IF_ELSE on connectionDegree splits into:
//   1st degree → warm path: gate → MESSAGE
//   3rd+ / null → cold path: CONNECT → wait → gate → MESSAGE
// One template, any list.
// ────────────────────────────────────────────────────────────────────────────
export function smartAudienceRouter(opts: {
    coldBeforeConnectDays: number;
    coldAfterAcceptDays: number;
    warmBeforeMsgDays: number;
    betweenMsgsDays: number;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
            enrichCompany: true, enrichAbout: true,
        }),
        node('n2', 2 * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Probe Degree'),
        node('split', 3 * Y_STEP, 'CONDITION', 'IF_ELSE', '1st-Degree?', {
            condition: { source: 'connectionState', field: 'connected', operator: 'is_true', probeOnNull: true },
        }),
        // WARM PATH (true)
        node('w_wait', 4 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.warmBeforeMsgDays}d`, { delayDays: opts.warmBeforeMsgDays }),
        node('w_msg1', 5 * Y_STEP, 'ACTION', 'MESSAGE', 'Warm Open (AI)', { aiEnabled: true, message: '' }),
        node('w_wait2', 6 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenMsgsDays}d`, { delayDays: opts.betweenMsgsDays }),
        node('w_msg2', 7 * Y_STEP, 'ACTION', 'MESSAGE', 'Warm Follow-up (AI)', { aiEnabled: true, message: '' }),
        // COLD PATH (false)
        node('c_wait1', 8 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.coldBeforeConnectDays}d`, { delayDays: opts.coldBeforeConnectDays }),
        node('c_invite', 9 * Y_STEP, 'ACTION', 'CONNECT', 'Send Invite (AI)', { aiEnabled: true, message: '' }),
        node('c_wait2', 10 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.coldAfterAcceptDays}d`, { delayDays: opts.coldAfterAcceptDays }),
        node('c_cc', 11 * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Confirm Accepted'),
        node('c_gate', 12 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Connected?', gateCondition),
        node('c_msg', 13 * Y_STEP, 'ACTION', 'MESSAGE', 'Cold Open (AI)', { aiEnabled: true, message: '' }),
        node('end_ok', 14 * Y_STEP, 'ACTION', 'END', 'End'),
        node('end_no', 15 * Y_STEP, 'ACTION', 'END', 'No connection'),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'split'),
        // warm path
        trueEdge('split', 'w_wait'),
        edge('w_wait', 'w_msg1'), edge('w_msg1', 'w_wait2'), edge('w_wait2', 'w_msg2'),
        edge('w_msg2', 'end_ok'),
        // cold path
        falseEdge('split', 'c_wait1'),
        edge('c_wait1', 'c_invite'), edge('c_invite', 'c_wait2'),
        edge('c_wait2', 'c_cc'), edge('c_cc', 'c_gate'),
        trueEdge('c_gate', 'c_msg'), edge('c_msg', 'end_ok'),
        falseEdge('c_gate', 'end_no'),
    ];
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 11. emailOnlyDrip — pure email sequence; no LinkedIn write actions. For
// users protecting their LinkedIn account or running compliant-only outreach.
// ────────────────────────────────────────────────────────────────────────────
export function emailOnlyDrip(opts: {
    betweenEmailsDays: number;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
            enrichCompany: true, enrichAbout: true, enrichContact: true,
        }),
        node('n2', 2 * Y_STEP, 'ACTION', 'EMAIL_FINDER', 'Find Email'),
        node('n3', 3 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Email Found?', {
            condition: { source: 'storedOutputs', field: 'email-finder.email', operator: 'is_not_null' },
        }),
        node('n4', 4 * Y_STEP, 'ACTION', 'EMAIL', 'Email #1 (AI)', { aiEnabled: true }),
        node('n5', 5 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenEmailsDays}d`, { delayDays: opts.betweenEmailsDays }),
        node('n6', 6 * Y_STEP, 'ACTION', 'EMAIL', 'Email #2 (AI)', { aiEnabled: true }),
        node('end_ok', 7 * Y_STEP, 'ACTION', 'END', 'End'),
        node('end_no', 8 * Y_STEP, 'ACTION', 'END', 'No email'),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'),
        trueEdge('n3', 'n4'), falseEdge('n3', 'end_no'),
        edge('n4', 'n5'), edge('n5', 'n6'), edge('n6', 'end_ok'),
    ];
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 12. channelSplitter — Waalaxy "Saturn" pattern. Invite → if accepted: 2 LI
// msgs; if rejected: email finder → 2 emails. ONE channel per lead, chosen
// at runtime. Saves email-finder credits on accepted invites.
// ────────────────────────────────────────────────────────────────────────────
export function channelSplitter(opts: {
    beforeConnectDays: number;
    afterAcceptDays: number;
    betweenMsgsDays: number;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
            enrichCompany: true, enrichAbout: true, enrichContact: true,
        }),
        node('n2', 2 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.beforeConnectDays}d`, { delayDays: opts.beforeConnectDays }),
        node('n3', 3 * Y_STEP, 'ACTION', 'CONNECT', 'Send Invite (AI)', { aiEnabled: true, message: '' }),
        node('n4', 4 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.afterAcceptDays}d`, { delayDays: opts.afterAcceptDays }),
        node('n5', 5 * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Check Accepted'),
        node('split', 6 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Accepted?', gateCondition),
        // LI path
        node('li_msg1', 7 * Y_STEP, 'ACTION', 'MESSAGE', 'LI Message 1 (AI)', { aiEnabled: true, message: '' }),
        node('li_wait', 8 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenMsgsDays}d`, { delayDays: opts.betweenMsgsDays }),
        node('li_msg2', 9 * Y_STEP, 'ACTION', 'MESSAGE', 'LI Follow-up (AI)', { aiEnabled: true, message: '' }),
        // Email path
        node('ef', 10 * Y_STEP, 'ACTION', 'EMAIL_FINDER', 'Find Email'),
        node('efgate', 11 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Email Found?', {
            condition: { source: 'storedOutputs', field: 'email-finder.email', operator: 'is_not_null' },
        }),
        node('em1', 12 * Y_STEP, 'ACTION', 'EMAIL', 'Email 1 (AI)', { aiEnabled: true }),
        node('em_wait', 13 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenMsgsDays}d`, { delayDays: opts.betweenMsgsDays }),
        node('em2', 14 * Y_STEP, 'ACTION', 'EMAIL', 'Email 2 (AI)', { aiEnabled: true }),
        node('end_ok', 15 * Y_STEP, 'ACTION', 'END', 'Reached'),
        node('end_no', 16 * Y_STEP, 'ACTION', 'END', 'No channel'),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'),
        edge('n3', 'n4'), edge('n4', 'n5'), edge('n5', 'split'),
        trueEdge('split', 'li_msg1'),
        edge('li_msg1', 'li_wait'), edge('li_wait', 'li_msg2'), edge('li_msg2', 'end_ok'),
        falseEdge('split', 'ef'),
        edge('ef', 'efgate'),
        trueEdge('efgate', 'em1'),
        edge('em1', 'em_wait'), edge('em_wait', 'em2'), edge('em2', 'end_ok'),
        falseEdge('efgate', 'end_no'),
    ];
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 13. emailFirstCrossroad — Waalaxy "Krypton" pattern inverted. Email-first;
// LinkedIn only fires when no email could be resolved.
// ────────────────────────────────────────────────────────────────────────────
export function emailFirstCrossroad(opts: {
    betweenEmailsDays: number;
    afterEmailLIDays: number;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
            enrichCompany: true, enrichAbout: true, enrichContact: true,
        }),
        node('n2', 2 * Y_STEP, 'ACTION', 'EMAIL_FINDER', 'Find Email'),
        node('split', 3 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Email Found?', {
            condition: { source: 'storedOutputs', field: 'email-finder.email', operator: 'is_not_null' },
        }),
        // Email-found path
        node('em1', 4 * Y_STEP, 'ACTION', 'EMAIL', 'Email 1 (AI)', { aiEnabled: true }),
        node('emw', 5 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenEmailsDays}d`, { delayDays: opts.betweenEmailsDays }),
        node('em2', 6 * Y_STEP, 'ACTION', 'EMAIL', 'Email 2 (AI)', { aiEnabled: true }),
        node('limw', 7 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.afterEmailLIDays}d`, { delayDays: opts.afterEmailLIDays }),
        node('liconn', 8 * Y_STEP, 'ACTION', 'CONNECT', 'LI Connect (AI)', { aiEnabled: true, message: '' }),
        // No-email path → cold LinkedIn
        node('cc', 9 * Y_STEP, 'ACTION', 'CONNECT', 'Cold LI Connect (AI)', { aiEnabled: true, message: '' }),
        node('end_ok', 10 * Y_STEP, 'ACTION', 'END', 'End'),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'split'),
        trueEdge('split', 'em1'),
        edge('em1', 'emw'), edge('emw', 'em2'), edge('em2', 'limw'), edge('limw', 'liconn'),
        edge('liconn', 'end_ok'),
        falseEdge('split', 'cc'),
        edge('cc', 'end_ok'),
    ];
    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// 14. heavyHitter — ABM no-stone-unturned. After invite acceptance, run 3 LI
// messages, then email-finder, then 3 emails. Reserved for top-20 accounts.
// ────────────────────────────────────────────────────────────────────────────
export function heavyHitter(opts: {
    beforeConnectDays: number;
    afterAcceptDays: number;
    betweenLIDays: number;
    betweenEmailDays: number;
}): WorkflowShape {
    const nodes: TemplateNode[] = [
        node('trigger', 0, 'TRIGGER', 'START', 'Trigger: Lead Added'),
        node('n1', 1 * Y_STEP, 'ACTION', 'PROFILE_VISIT', 'Visit Profile', {
            enrichCompany: true, enrichAbout: true, enrichContact: true, enrichPosts: true,
        }),
        node('n2', 2 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.beforeConnectDays}d`, { delayDays: opts.beforeConnectDays }),
        node('n3', 3 * Y_STEP, 'ACTION', 'CONNECT', 'Send Invite (AI)', { aiEnabled: true, message: '' }),
        node('n4', 4 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.afterAcceptDays}d`, { delayDays: opts.afterAcceptDays }),
        node('n5', 5 * Y_STEP, 'ACTION', 'CHECK_CONNECTION', 'Confirm Accepted'),
        node('n6', 6 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Connected?', gateCondition),
        node('lim1', 7 * Y_STEP, 'ACTION', 'MESSAGE', 'LI Msg 1 (AI)', { aiEnabled: true, message: '' }),
        node('liw1', 8 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenLIDays}d`, { delayDays: opts.betweenLIDays }),
        node('lim2', 9 * Y_STEP, 'ACTION', 'MESSAGE', 'LI Msg 2 (AI)', { aiEnabled: true, message: '' }),
        node('liw2', 10 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenLIDays}d`, { delayDays: opts.betweenLIDays }),
        node('lim3', 11 * Y_STEP, 'ACTION', 'MESSAGE', 'LI Msg 3 (AI)', { aiEnabled: true, message: '' }),
        node('ef', 12 * Y_STEP, 'ACTION', 'EMAIL_FINDER', 'Find Email'),
        node('efgate', 13 * Y_STEP, 'CONDITION', 'IF_ELSE', 'Email Found?', {
            condition: { source: 'storedOutputs', field: 'email-finder.email', operator: 'is_not_null' },
        }),
        node('em1', 14 * Y_STEP, 'ACTION', 'EMAIL', 'Email 1 (AI)', { aiEnabled: true }),
        node('ew1', 15 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenEmailDays}d`, { delayDays: opts.betweenEmailDays }),
        node('em2', 16 * Y_STEP, 'ACTION', 'EMAIL', 'Email 2 (AI)', { aiEnabled: true }),
        node('ew2', 17 * Y_STEP, 'DELAY', 'WAIT', `Wait ${opts.betweenEmailDays}d`, { delayDays: opts.betweenEmailDays }),
        node('em3', 18 * Y_STEP, 'ACTION', 'EMAIL', 'Email 3 (AI)', { aiEnabled: true }),
        node('end_ok', 19 * Y_STEP, 'ACTION', 'END', 'End'),
        node('end_no_li', 20 * Y_STEP, 'ACTION', 'END', 'Not Accepted'),
        node('end_no_em', 21 * Y_STEP, 'ACTION', 'END', 'LI only'),
    ];
    const edges: TemplateEdge[] = [
        edge('trigger', 'n1'), edge('n1', 'n2'), edge('n2', 'n3'),
        edge('n3', 'n4'), edge('n4', 'n5'), edge('n5', 'n6'),
        trueEdge('n6', 'lim1'), falseEdge('n6', 'end_no_li'),
        edge('lim1', 'liw1'), edge('liw1', 'lim2'),
        edge('lim2', 'liw2'), edge('liw2', 'lim3'),
        edge('lim3', 'ef'), edge('ef', 'efgate'),
        trueEdge('efgate', 'em1'), falseEdge('efgate', 'end_no_em'),
        edge('em1', 'ew1'), edge('ew1', 'em2'),
        edge('em2', 'ew2'), edge('ew2', 'em3'),
        edge('em3', 'end_ok'),
    ];
    return { nodes, edges };
}
