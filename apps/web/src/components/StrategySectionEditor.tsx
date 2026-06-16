'use client';

import { EditableText } from './ui/editable-text';
import { TagInput } from './ui/tag-input';
import { getStrategyLabels } from '@/lib/strategyLabels';

/**
 * Inline, no-JSON editor for each strategy section. Renders friendly controls
 * (click-to-edit text, chip inputs) instead of the old raw-JSON textarea, and
 * calls onChange with the updated section value (the page persists it via
 * PUT /strategy { overrides: { [key]: value } }).
 *
 * messagingPillars and commentStrategy are handled by their own editors on the
 * page; this covers gtm / icp / outreachAngles / objections / competitiveLandscape.
 */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.13em] mb-2.5">{label}</p>
            {children}
        </div>
    );
}

export default function StrategySectionEditor({
    sectionKey,
    value,
    goalType,
    onChange,
}: {
    sectionKey: string;
    value: any;
    goalType?: string;
    onChange: (next: any) => void;
}) {
    const v = value || {};
    const set = (patch: any) => onChange({ ...v, ...patch });
    const L = getStrategyLabels(goalType);

    switch (sectionKey) {
        case 'gtm':
            return (
                <div className="space-y-5">
                    <Field label={L.gtm.positioning}>
                        <EditableText value={v.positioning || ''} multiline onCommit={(t) => set({ positioning: t })} placeholder="One-line positioning statement…" />
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label={L.gtm.primaryChannel}><EditableText value={v.primaryChannel || ''} onCommit={(t) => set({ primaryChannel: t })} /></Field>
                        <Field label={L.gtm.salesMotion}><EditableText value={v.salesMotion || ''} onCommit={(t) => set({ salesMotion: t })} /></Field>
                        <Field label={L.gtm.averageDealSize}><EditableText value={v.averageDealSize || ''} onCommit={(t) => set({ averageDealSize: t })} /></Field>
                        <Field label={L.gtm.salesCycle}><EditableText value={v.salesCycle || ''} onCommit={(t) => set({ salesCycle: t })} /></Field>
                    </div>
                    <Field label={L.gtm.buyingCommittee}>
                        <TagInput value={Array.isArray(v.buyingCommittee) ? v.buyingCommittee : []} onChange={(next) => set({ buyingCommittee: next })} placeholder={L.gtm.buyingCommitteePlaceholder} tone="slate" />
                    </Field>
                </div>
            );

        case 'icp': {
            const primary = v.primary || {};
            const secondary = v.secondary || {};
            const setPrimary = (patch: any) => onChange({ ...v, primary: { ...primary, ...patch } });
            const setSecondary = (patch: any) => onChange({ ...v, secondary: { ...secondary, ...patch } });
            return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-4 bg-slate-50/40">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">{L.icp.primaryHeader}</p>
                        <Field label={L.icp.title}><EditableText value={primary.title || ''} onCommit={(t) => setPrimary({ title: t })} /></Field>
                        <Field label={L.icp.companySize}><EditableText value={primary.companySize || ''} onCommit={(t) => setPrimary({ companySize: t })} /></Field>
                        <Field label={L.icp.painPoints}><TagInput value={Array.isArray(primary.painPoints) ? primary.painPoints : []} onChange={(next) => setPrimary({ painPoints: next })} placeholder={L.icp.painPointsPlaceholder} tone="rose" /></Field>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 space-y-4 bg-slate-50/40">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{L.icp.secondaryHeader}</p>
                        <Field label={L.icp.title}><EditableText value={secondary.title || ''} onCommit={(t) => setSecondary({ title: t })} /></Field>
                        <Field label={L.icp.companySize}><EditableText value={secondary.companySize || ''} onCommit={(t) => setSecondary({ companySize: t })} /></Field>
                        <Field label={L.icp.painPoints}><TagInput value={Array.isArray(secondary.painPoints) ? secondary.painPoints : []} onChange={(next) => setSecondary({ painPoints: next })} placeholder={L.icp.painPointsPlaceholder} tone="rose" /></Field>
                    </div>
                </div>
            );
        }

        case 'outreachAngles': {
            const entries = v && typeof v === 'object' ? Object.entries(v) : [];
            return (
                <div className="space-y-3">
                    {entries.map(([persona, angle]: [string, any]) => {
                        const setAngle = (patch: any) => onChange({ ...v, [persona]: { ...(angle || {}), ...patch } });
                        return (
                            <div key={persona} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                <p className="text-sm font-black text-slate-900 capitalize">{persona.replace(/([A-Z])/g, ' $1')}</p>
                                <Field label="Hook"><EditableText value={angle?.hook || ''} multiline onCommit={(t) => setAngle({ hook: t })} /></Field>
                                <Field label="Tone"><EditableText value={angle?.tone || ''} onCommit={(t) => setAngle({ tone: t })} /></Field>
                            </div>
                        );
                    })}
                    {entries.length === 0 && <p className="text-sm text-muted-foreground italic">No outreach angles yet.</p>}
                </div>
            );
        }

        case 'objections': {
            const entries = v && typeof v === 'object' ? Object.entries(v) : [];
            return (
                <div className="space-y-3">
                    {entries.map(([key, obj]: [string, any]) => {
                        const setObj = (patch: any) => onChange({ ...v, [key]: { ...(obj || {}), ...patch } });
                        return (
                            <div key={key} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                                <p className="text-sm font-black text-slate-900 capitalize">{key.replace(/_/g, ' ')}</p>
                                <Field label="Response"><EditableText value={obj?.response || ''} multiline onCommit={(t) => setObj({ response: t })} /></Field>
                                <Field label="Pivot"><EditableText value={obj?.pivot || ''} multiline onCommit={(t) => setObj({ pivot: t })} /></Field>
                            </div>
                        );
                    })}
                    {entries.length === 0 && <p className="text-sm text-muted-foreground italic">No objections yet.</p>}
                </div>
            );
        }

        case 'competitiveLandscape':
            return (
                <div className="space-y-4">
                    <Field label={L.competitive.directCompetitors}><TagInput value={Array.isArray(v.directCompetitors) ? v.directCompetitors : []} onChange={(next) => set({ directCompetitors: next })} placeholder={L.competitive.directCompetitorsPlaceholder} tone="slate" /></Field>
                    <Field label={L.competitive.ourAdvantages}><TagInput value={Array.isArray(v.ourAdvantages) ? v.ourAdvantages : []} onChange={(next) => set({ ourAdvantages: next })} placeholder="Add an advantage…" tone="emerald" /></Field>
                    <Field label={L.competitive.theirWeaknesses}><TagInput value={Array.isArray(v.theirWeaknesses) ? v.theirWeaknesses : []} onChange={(next) => set({ theirWeaknesses: next })} placeholder="Add a weakness…" tone="amber" /></Field>
                    <Field label={L.competitive.whenToMention}><EditableText value={v.whenToMention || ''} multiline onCommit={(t) => set({ whenToMention: t })} /></Field>
                </div>
            );

        default:
            return <p className="text-sm text-muted-foreground italic">Nothing to edit here.</p>;
    }
}
