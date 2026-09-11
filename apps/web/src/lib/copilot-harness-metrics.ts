import type { CopilotHarnessTurn } from './copilot-harness-store';

export interface CopilotHarnessSummary {
    totalTurns: number;
    routeTurns: number;
    routeSuccessRate: number;
    averageRouteLatencyMs: number;
    replyDrafts: number;
    sentDrafts: number;
    editedDrafts: number;
    regeneratedDrafts: number;
    failedDrafts: number;
    flaggedDrafts: number;
    sendRate: number;
}

const percent = (part: number, total: number) => total ? Math.round((part / total) * 100) : 0;

export function summarizeCopilotHarness(turns: CopilotHarnessTurn[]): CopilotHarnessSummary {
    const routes = turns.filter((turn) => turn.kind === 'route' || !turn.kind);
    const replies = turns.filter((turn) => turn.kind === 'reply_draft');
    const routeSuccesses = routes.filter((turn) => turn.success).length;
    const sent = replies.filter((turn) => turn.outcome === 'sent').length;
    const failed = replies.filter((turn) => turn.outcome === 'failed' || turn.outcome === 'send_failed').length;
    const latencyTotal = routes.reduce((sum, turn) => sum + (turn.latencyMs || 0), 0);

    return {
        totalTurns: turns.length,
        routeTurns: routes.length,
        routeSuccessRate: percent(routeSuccesses, routes.length),
        averageRouteLatencyMs: routes.length ? Math.round(latencyTotal / routes.length) : 0,
        replyDrafts: replies.length,
        sentDrafts: sent,
        editedDrafts: replies.filter((turn) => turn.edited).length,
        regeneratedDrafts: replies.filter((turn) => turn.outcome === 'regenerated').length,
        failedDrafts: failed,
        flaggedDrafts: replies.filter((turn) => (turn.qualityFlags?.length || 0) > 0).length,
        sendRate: percent(sent, replies.length),
    };
}
