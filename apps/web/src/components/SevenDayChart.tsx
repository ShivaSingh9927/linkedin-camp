"use client";

interface Series {
    date: string;
    invites: number;
    messages: number;
    replies: number;
}

interface Props {
    data: Series[];
}

// Compact 3-line chart for the campaign detail page. Pure SVG so no
// extra deps (recharts would balloon the bundle for a tiny visual).
export function SevenDayChart({ data }: Props) {
    if (!data || data.length === 0) return null;

    const W = 700, H = 200, PADDING = 30;
    const all = data.flatMap(d => [d.invites, d.messages, d.replies]);
    const max = Math.max(1, ...all);

    const xStep = (W - 2 * PADDING) / Math.max(1, data.length - 1);
    const yFor = (v: number) => H - PADDING - (v / max) * (H - 2 * PADDING);
    const points = (key: keyof Series) =>
        data.map((d, i) => `${PADDING + i * xStep},${yFor(d[key] as number)}`).join(' ');
    const areaPath = () => {
        const top = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${PADDING + i * xStep} ${yFor(d.invites)}`).join(' ');
        return `${top} L ${PADDING + (data.length - 1) * xStep} ${H - PADDING} L ${PADDING} ${H - PADDING} Z`;
    };
    const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return (
        <div className="bg-card border border-line rounded-card p-6 space-y-5 shadow-soft">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-bold tracking-tight">Last 7 days</h3>
                <div className="flex items-center gap-4 text-xs">
                    <Legend color="#8b5cf6" label="Invites" />
                    <Legend color="#3b82f6" label="Messages" />
                    <Legend color="#a855f7" label="Replies" />
                </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-48">
                <defs>
                    <linearGradient id="invitesGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map(r => (
                    <line key={r} x1={PADDING} y1={PADDING + r * (H - 2 * PADDING)} x2={W - PADDING} y2={PADDING + r * (H - 2 * PADDING)}
                          stroke="#e2e8f0" strokeDasharray="3,3" />
                ))}
                <path d={areaPath()} fill="url(#invitesGrad)" />
                <polyline points={points('invites')}  stroke="#8b5cf6" strokeWidth={3} fill="none" strokeLinejoin="round" />
                <polyline points={points('messages')} stroke="#3b82f6" strokeWidth={3} fill="none" strokeLinejoin="round" />
                <polyline points={points('replies')}  stroke="#a855f7" strokeWidth={3} fill="none" strokeLinejoin="round" />
                {data.map((d, i) => (
                    <g key={d.date}>
                        <circle cx={PADDING + i * xStep} cy={yFor(d.invites)} r={4} fill="#8b5cf6" />
                        <text x={PADDING + i * xStep} y={H + 12} fontSize={11} fontWeight={700} fill="#64748b" textAnchor="middle">
                            {fmt(d.date)}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}

function Legend({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[11px] font-semibold text-ink-500">{label}</span>
        </span>
    );
}
