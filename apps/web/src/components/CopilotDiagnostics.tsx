'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Download, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui';
import {
    clearCopilotHarnessTurns,
    readCopilotHarnessTurns,
    type CopilotHarnessTurn,
} from '@/lib/copilot-harness-store';
import { summarizeCopilotHarness } from '@/lib/copilot-harness-metrics';

export default function CopilotDiagnostics() {
    const [turns, setTurns] = useState<CopilotHarnessTurn[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        setTurns(await readCopilotHarnessTurns().catch(() => []));
        setLoading(false);
    }, []);

    useEffect(() => {
        let active = true;
        readCopilotHarnessTurns()
            .catch(() => [])
            .then((rows) => {
                if (!active) return;
                setTurns(rows);
                setLoading(false);
            });
        return () => { active = false; };
    }, []);
    const summary = useMemo(() => summarizeCopilotHarness(turns), [turns]);

    const exportData = () => {
        const payload = JSON.stringify({
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            privacy: 'No prompts, replies, lead data, profile URLs, cookies, or tokens.',
            summary,
            turns,
        }, null, 2);
        const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `qampi-copilot-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const clearData = async () => {
        if (!window.confirm('Clear all locally stored copilot diagnostics from this browser?')) return;
        await clearCopilotHarnessTurns();
        setTurns([]);
        toast.success('Local copilot diagnostics cleared');
    };

    const cards = [
        { label: 'Router success', value: summary.routeTurns ? `${summary.routeSuccessRate}%` : '—', detail: `${summary.routeTurns} routed turns` },
        { label: 'Average latency', value: summary.routeTurns ? `${summary.averageRouteLatencyMs} ms` : '—', detail: 'Router response time' },
        { label: 'Draft send rate', value: summary.replyDrafts ? `${summary.sendRate}%` : '—', detail: `${summary.sentDrafts} of ${summary.replyDrafts} drafts sent` },
        { label: 'Quality flags', value: String(summary.flaggedDrafts), detail: `${summary.editedDrafts} edited · ${summary.regeneratedDrafts} regenerated` },
    ];

    return (
        <Card className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-brand" />
                        <h2 className="text-lg font-bold text-ink-900">Copilot diagnostics</h2>
                    </div>
                    <p className="text-sm text-ink-500 mt-1 max-w-2xl">
                        Quality and outcome signals stored only in this browser for 30 days. Prompts, replies, lead details, URLs, cookies, and tokens are never recorded.
                    </p>
                </div>
                <button onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 text-xs font-semibold text-ink-600 hover:text-ink-900 disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-6">
                {cards.map((item) => (
                    <div key={item.label} className="rounded-card border border-line bg-ink-50/50 p-4 min-w-0">
                        <div className="text-[11px] uppercase tracking-wide font-bold text-ink-500">{item.label}</div>
                        <div className="text-2xl font-black text-ink-900 mt-1">{item.value}</div>
                        <div className="text-xs text-ink-500 mt-1 truncate">{item.detail}</div>
                    </div>
                ))}
            </div>

            {!loading && summary.totalTurns === 0 && (
                <div className="mt-5 rounded-control border border-dashed border-line p-4 text-sm text-ink-500">
                    No local samples yet. Use the copilot or generate a reply, then return here to inspect the results.
                </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6 pt-5 border-t border-line">
                <button onClick={() => void clearData()} disabled={!turns.length} className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-control border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-40">
                    <Trash2 className="w-4 h-4" /> Clear local data
                </button>
                <button onClick={exportData} disabled={!turns.length} className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-control bg-ink-900 text-white text-sm font-semibold hover:bg-ink-800 disabled:opacity-40">
                    <Download className="w-4 h-4" /> Export JSON
                </button>
            </div>
        </Card>
    );
}
