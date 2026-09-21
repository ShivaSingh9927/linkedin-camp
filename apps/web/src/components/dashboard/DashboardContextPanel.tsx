'use client';

import { useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCopilot } from '@/components/copilot/CopilotProvider';
import type { Msg } from '@/components/copilot/copilotTypes';
import type { SearchPerson, TemplatePick } from '@/components/copilot/copilotApi';
import type { SetupStatus } from '@/components/ActivationHero';
import { DynamicStatusPanel, type StatusCampaign, type StatusLog } from './DynamicStatusPanel';

type View = 'status' | 'leads' | 'campaigns';
type ContentMode = 'ai' | 'custom';

interface Props {
    campaigns: StatusCampaign[];
    logs: StatusLog[];
    setup: SetupStatus | null;
    loading: boolean;
    quotas: { label: string; value: number; total: number }[];
    kpis: { label: string; value: string; detail: string }[];
}

function latestArtifact(messages: Msg[]) {
    return [...messages].reverse().find((m) => m.kind === 'results' || m.kind === 'templates') as
        | Extract<Msg, { kind: 'results' | 'templates' }>
        | undefined;
}

export function DashboardContextPanel(props: Props) {
    const { messages, setWorkspaceContext } = useCopilot();
    const artifact = useMemo(() => latestArtifact(messages), [messages]);
    const latestResults = useMemo(
        () => [...messages].reverse().find((m): m is Extract<Msg, { kind: 'results' }> => m.kind === 'results'),
        [messages],
    );
    const [navigation, setNavigation] = useState<{ artifactId?: string; view?: View }>({});
    if (artifact && navigation.artifactId !== artifact.id) {
        setNavigation({ artifactId: artifact.id });
    }
    const view: View = navigation.view || (artifact?.kind === 'results' ? 'leads' : artifact?.kind === 'templates' ? 'campaigns' : 'status');

    const showStatus = () => {
        setNavigation({ artifactId: artifact?.id, view: 'status' });
        setWorkspaceContext({ kind: 'status', label: 'Outreach status', detail: 'live campaign activity' });
    };

    if (view === 'status') return <DynamicStatusPanel {...props} />;

    if (view === 'leads' && latestResults) {
        return (
            <ContextShell title="Matched leads" subtitle={`${latestResults.people.length} results from Qampi`} onClose={showStatus}>
                <LeadsContext people={latestResults.people} />
            </ContextShell>
        );
    }

    const picks = artifact?.kind === 'templates' ? artifact.picks || [] : [];
    return (
        <ContextShell
            title="Campaign recommendations"
            subtitle="Review the rationale and fixed flow"
            onClose={showStatus}
            back={latestResults ? () => {
                setNavigation({ artifactId: artifact?.id, view: 'leads' });
                setWorkspaceContext({ kind: 'leads', label: 'Matched leads', detail: `${latestResults.people.length} results` });
            } : undefined}
        >
            <CampaignsContext picks={picks} />
        </ContextShell>
    );
}

function ContextShell({ title, subtitle, children, onClose, back }: {
    title: string;
    subtitle: string;
    children: ReactNode;
    onClose: () => void;
    back?: () => void;
}) {
    return (
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-line bg-card shadow-soft">
            <header className="flex shrink-0 items-center gap-2 border-b border-line px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">{title}</p>
                    <p className="truncate text-[10px] text-ink-500">{subtitle}</p>
                </div>
                {back && <button onClick={back} className="inline-flex h-7 items-center gap-1 rounded-control border border-line px-2 text-[10px] font-medium text-ink-600 hover:border-brand-200 hover:text-brand"><ArrowLeft className="h-3 w-3" /> Leads</button>}
                <button onClick={onClose} aria-label="Close context and show status" className="grid h-7 w-7 place-items-center rounded-control text-ink-400 hover:bg-surface hover:text-ink-700"><X className="h-3.5 w-3.5" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </section>
    );
}

function LeadsContext({ people }: { people: SearchPerson[] }) {
    const { setWorkspaceContext } = useCopilot();
    const [open, setOpen] = useState<number | null>(people.length ? 0 : null);
    const [selected, setSelected] = useState<Set<number>>(() => new Set(people.length ? [0] : []));

    const toggleSelected = (index: number) => {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(index)) next.delete(index); else next.add(index);
            setWorkspaceContext({ kind: 'leads', label: 'Matched leads', detail: `${next.size} selected` });
            return next;
        });
    };

    return (
        <div className="min-w-[480px]">
            <div className="grid grid-cols-[34px_minmax(150px,1.5fr)_1fr_1fr_28px] border-b border-line bg-surface/60 px-2 text-[10px] font-medium text-ink-500">
                <span className="py-2.5" /><span className="py-2.5">Lead</span><span className="py-2.5">Current role</span><span className="py-2.5">Company</span><span />
            </div>
            {people.map((person, index) => {
                const expanded = open === index;
                return (
                    <div key={`${person.linkedinUrl}-${index}`} className={cn('border-b border-line', selected.has(index) && 'bg-brand-50/40')}>
                        <div className="grid cursor-pointer grid-cols-[34px_minmax(150px,1.5fr)_1fr_1fr_28px] items-center px-2 text-[11px] text-ink-700 hover:bg-surface/70" onClick={() => {
                            setOpen(expanded ? null : index);
                            setWorkspaceContext({ kind: 'lead', label: person.name, detail: `${person.jobTitle || 'Lead'} at ${person.company || 'Unknown company'}` });
                        }}>
                            <span className="py-2.5" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.has(index)} onChange={() => toggleSelected(index)} aria-label={`Select ${person.name}`} className="accent-brand" /></span>
                            <span className="truncate py-2.5 font-medium text-foreground">{person.name}</span>
                            <span className="truncate py-2.5">{person.jobTitle || '—'}</span>
                            <span className="truncate py-2.5">{person.company || '—'}</span>
                            <ChevronDown className={cn('h-3.5 w-3.5 text-ink-400 transition-transform', expanded && 'rotate-180')} />
                        </div>
                        {expanded && (
                            <div className="grid grid-cols-2 gap-3 border-t border-line bg-card px-4 py-3 text-[11px]">
                                <div><p className="label !text-[9px]">Profile</p><p className="mt-1 text-ink-600">{person.headline || person.jobTitle}</p><p className="mt-1 text-ink-500">{person.location || 'Location unavailable'} · {person.connectionDegree ? `${person.connectionDegree}° connection` : 'Degree unavailable'}</p></div>
                                <div><p className="label !text-[9px]">Source</p><a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand hover:underline">Open LinkedIn <ExternalLink className="h-3 w-3" /></a><p className="mt-1 text-ink-400">Selected lead context is shared with Qampi.</p></div>
                            </div>
                        )}
                    </div>
                );
            })}
            {!people.length && <p className="p-8 text-center text-[12px] text-ink-500">No leads in this search result.</p>}
        </div>
    );
}

function CampaignsContext({ picks }: { picks: TemplatePick[] }) {
    const { setWorkspaceContext } = useCopilot();
    const recommendations = picks.slice(0, 3);
    const [openId, setOpenId] = useState<string | null>(recommendations[0]?.templateId || null);
    const [modes, setModes] = useState<Record<string, ContentMode>>({});

    if (!recommendations.length) return <p className="p-8 text-center text-[12px] text-ink-500">Qampi is preparing campaign recommendations.</p>;

    return (
        <div className="space-y-2.5 p-3">
            <div className="flex items-center justify-between gap-3 px-1">
                <div><p className="text-[11px] font-medium text-foreground">Recommended for your selected leads</p><p className="text-[9px] text-ink-500">Nodes and timing are fixed. Only content nodes can be customized.</p></div>
                <Link href="/campaigns" className="shrink-0 text-[10px] font-medium text-brand hover:underline">More templates →</Link>
            </div>
            {recommendations.map((pick, index) => {
                const expanded = openId === pick.templateId;
                return (
                    <article key={pick.templateId} className={cn('overflow-hidden rounded-control border bg-card', expanded ? 'border-brand-200 shadow-[inset_3px_0_0_var(--color-brand)]' : 'border-line')}>
                        <button className="flex w-full items-center gap-2 px-3 py-3 text-left hover:bg-surface/50" onClick={() => {
                            setOpenId(expanded ? null : pick.templateId);
                            setWorkspaceContext({ kind: 'campaign', label: pick.label, detail: 'reviewing recommendation' });
                        }}>
                            <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><strong className="truncate text-[12px] text-foreground">{pick.label}</strong><span className="rounded-control bg-brand-50 px-1.5 py-0.5 text-[8px] font-medium text-brand">{index === 0 ? 'Best match' : 'Recommended'}</span></span><span className="mt-1 block text-[9px] text-ink-500">{pick.stepCount} nodes · {pick.durationDays} days · {pick.needsEmail ? 'LinkedIn + email' : 'LinkedIn'}</span></span>
                            <ChevronDown className={cn('h-4 w-4 text-ink-400 transition-transform', expanded && 'rotate-180')} />
                        </button>
                        {expanded && <CampaignFlow pick={pick} modes={modes} setModes={setModes} />}
                    </article>
                );
            })}
        </div>
    );
}

function CampaignFlow({ pick, modes, setModes }: { pick: TemplatePick; modes: Record<string, ContentMode>; setModes: Dispatch<SetStateAction<Record<string, ContentMode>>> }) {
    const { setWorkspaceContext } = useCopilot();
    const contentNodes = pick.needsEmail ? ['Connection message', 'LinkedIn message', 'Email', 'Comment'] : ['Connection message', 'LinkedIn message', 'Comment'];
    const setMode = (node: string, mode: ContentMode) => {
        setModes((current) => ({ ...current, [`${pick.templateId}:${node}`]: mode }));
        setWorkspaceContext({ kind: 'node', label: node, detail: `${mode === 'ai' ? 'AI' : 'Custom'} mode in ${pick.label}` });
    };
    return (
        <div className="border-t border-line bg-surface/35 px-3 pb-3 pt-2.5">
            <p className="rounded-control bg-brand-50 px-2.5 py-2 text-[10px] leading-relaxed text-ink-600"><strong className="text-foreground">Why:</strong> {pick.why}</p>
            <div className="mt-2.5 grid grid-cols-3 overflow-hidden rounded-control border border-line bg-card text-[9px]"><Fact label="Audience" value="Selected leads" /><Fact label="Duration" value={`${pick.durationDays} days`} /><Fact label="Structure" value="Fixed flow" /></div>
            <div className="mt-3 space-y-2">
                <FixedNode number="1" title="Visit profile" detail="Runs immediately" />
                <ContentNode number="2" title={contentNodes[0]} mode={modes[`${pick.templateId}:${contentNodes[0]}`] || 'ai'} onMode={(mode) => setMode(contentNodes[0], mode)} />
                <FixedNode number="3" title="Wait for outcome" detail="Branches automatically" />
                <div className="ml-6 rounded-control border border-line bg-card p-2">
                    <div className="mb-2 flex items-center justify-between"><span className="text-[9px] font-medium text-foreground">Connection outcome</span><span className="text-[8px] text-ink-400">Automatic branch</span></div>
                    <div className="grid grid-cols-2 gap-2"><Branch label="Accepted" node={contentNodes[1]} mode={modes[`${pick.templateId}:${contentNodes[1]}`] || 'ai'} onMode={(mode) => setMode(contentNodes[1], mode)} /><Branch label="Not accepted" node={pick.needsEmail ? 'Email' : 'Comment'} mode={modes[`${pick.templateId}:${pick.needsEmail ? 'Email' : 'Comment'}`] || 'ai'} onMode={(mode) => setMode(pick.needsEmail ? 'Email' : 'Comment', mode)} /></div>
                    <p className="mt-2 text-center text-[8px] text-ink-400">Paths rejoin automatically</p>
                </div>
                <FixedNode number="5" title="Wait" detail="Template-defined delay" />
                <ContentNode number="6" title="Comment" mode={modes[`${pick.templateId}:Comment`] || 'ai'} onMode={(mode) => setMode('Comment', mode)} />
            </div>
            <button onClick={() => setWorkspaceContext({ kind: 'campaign', label: pick.label, detail: 'ready to confirm with Qampi' })} className="mt-3 w-full rounded-control bg-brand px-3 py-2 text-[11px] font-medium text-white hover:bg-brand-600">Continue with Qampi</button>
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="border-r border-line px-2 py-2 last:border-r-0"><span className="block text-ink-400">{label}</span><strong className="mt-0.5 block text-foreground">{value}</strong></div>; }
function FixedNode({ number, title, detail }: { number: string; title: string; detail: string }) { return <div className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-control border border-line bg-card text-[8px] font-medium text-ink-500">{number}</span><div className="min-w-0 flex-1 rounded-control border border-line bg-card px-2.5 py-2"><div className="flex items-center justify-between gap-2"><strong className="text-[9px] text-foreground">{title}</strong><span className="text-[8px] text-emerald-600">Fixed</span></div><p className="mt-1 text-[8px] text-ink-400">{detail}</p></div></div>; }
function ModeSwitch({ mode, onMode }: { mode: ContentMode; onMode: (mode: ContentMode) => void }) { return <div className="mt-1.5 inline-flex rounded-control border border-line bg-surface p-0.5"><button onClick={() => onMode('ai')} className={cn('rounded px-1.5 py-0.5 text-[8px]', mode === 'ai' ? 'bg-card text-brand shadow-sm' : 'text-ink-400')}>AI</button><button onClick={() => onMode('custom')} className={cn('rounded px-1.5 py-0.5 text-[8px]', mode === 'custom' ? 'bg-card text-brand shadow-sm' : 'text-ink-400')}>Custom</button></div>; }
function ContentNode({ number, title, mode, onMode }: { number: string; title: string; mode: ContentMode; onMode: (mode: ContentMode) => void }) { return <div className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-control border border-line bg-card text-[8px] font-medium text-ink-500">{number}</span><div className="min-w-0 flex-1 rounded-control border border-line bg-card px-2.5 py-2"><div className="flex items-center justify-between gap-2"><strong className="text-[9px] text-foreground">{title}</strong><span className="text-[8px] text-brand">{mode === 'ai' ? 'AI draft' : 'Custom'}</span></div><ModeSwitch mode={mode} onMode={onMode} /><p className="mt-1.5 text-[8px] leading-relaxed text-ink-500">{mode === 'ai' ? 'Qampi will personalize this content for each lead.' : 'Write and confirm your own content with Qampi.'}</p></div></div>; }
function Branch({ label, node, mode, onMode }: { label: string; node: string; mode: ContentMode; onMode: (mode: ContentMode) => void }) { return <div className="min-w-0"><p className="mb-1 text-[8px] font-medium uppercase tracking-wide text-ink-400">{label}</p><div className="rounded-control border border-line bg-surface/50 p-2"><strong className="block truncate text-[8px] text-foreground">{node}</strong><ModeSwitch mode={mode} onMode={onMode} /></div></div>; }
