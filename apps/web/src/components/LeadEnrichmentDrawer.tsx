'use client';

import { X, ExternalLink, Mail, Phone, MapPin, Briefcase, GraduationCap, Sparkles, FileText } from 'lucide-react';

export interface EnrichedLead {
    name?: string;
    firstName?: string | null;
    lastName?: string | null;
    linkedinUrl?: string | null;
    headline?: string | null;
    jobTitle?: string | null;
    company?: string | null;
    location?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
    aboutInfo?: string | null;
    connectionDegree?: number | null;
    experience?: any;
    education?: any;
    enrichedAt?: string | null;
}

export function degreeLabel(d?: number | null): string | null {
    if (d == null) return null;
    if (d === 1) return '1st';
    if (d === 2) return '2nd';
    return '3rd+';
}

export function timeAgo(iso?: string | null): string | null {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return null;
    const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

function asArray(v: any): any[] {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
        try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
}

/**
 * Right-side drawer showing everything PROFILE_VISIT captured for a lead:
 * headline, role, location, contact, about, experience, education, plus
 * enrichment freshness. Shared by the campaign Leads tab and the Prospects page.
 */
export function LeadEnrichmentDrawer({ lead, onClose }: { lead: EnrichedLead | null; onClose: () => void }) {
    if (!lead) return null;

    const name = lead.name || [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Lead';
    const experience = asArray(lead.experience);
    const education = asArray(lead.education);
    const enriched = timeAgo(lead.enrichedAt);
    const degree = degreeLabel(lead.connectionDegree);
    const roleLine = [lead.jobTitle, lead.company].filter(Boolean).join(' · ');

    const Row = ({ icon: Icon, label, value, href }: { icon: any; label: string; value?: string | null; href?: string }) =>
        value ? (
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    {href ? (
                        <a href={href} target="_blank" rel="noopener" className="text-sm font-bold text-violet-600 hover:underline break-all">{value}</a>
                    ) : (
                        <p className="text-sm font-bold text-slate-800 break-words">{value}</p>
                    )}
                </div>
            </div>
        ) : null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-black text-slate-900 truncate">{name}</h3>
                                {degree && (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">{degree}</span>
                                )}
                            </div>
                            {(lead.headline || roleLine) && (
                                <p className="text-sm font-bold text-slate-500 mt-0.5 line-clamp-2">{lead.headline || roleLine}</p>
                            )}
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 flex-shrink-0"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                        {lead.linkedinUrl && (
                            <a href={lead.linkedinUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:underline">
                                <ExternalLink className="w-3.5 h-3.5" /> LinkedIn profile
                            </a>
                        )}
                        {enriched && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                                <Sparkles className="w-3.5 h-3.5" /> Enriched {enriched}
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Quick facts */}
                    <div className="space-y-3">
                        <Row icon={Briefcase} label="Role" value={roleLine || null} />
                        <Row icon={MapPin} label="Location" value={lead.location || lead.country || null} />
                        <Row icon={Mail} label="Email" value={lead.email || null} href={lead.email ? `mailto:${lead.email}` : undefined} />
                        <Row icon={Phone} label="Phone" value={lead.phone || null} />
                    </div>

                    {/* About */}
                    {lead.aboutInfo && (
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> About</p>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{lead.aboutInfo}</p>
                        </div>
                    )}

                    {/* Experience */}
                    {experience.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Experience</p>
                            <div className="space-y-3">
                                {experience.map((e: any, i: number) => (
                                    <div key={i} className="border-l-2 border-slate-100 pl-3">
                                        <p className="text-sm font-bold text-slate-800">{e.title || e.jobTitle || '—'}</p>
                                        <p className="text-xs text-slate-500">{[e.company, e.dateRange || e.duration].filter(Boolean).join(' · ')}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Education */}
                    {education.length > 0 && (
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Education</p>
                            <div className="space-y-3">
                                {education.map((e: any, i: number) => (
                                    <div key={i} className="border-l-2 border-slate-100 pl-3">
                                        <p className="text-sm font-bold text-slate-800">{e.school || '—'}</p>
                                        <p className="text-xs text-slate-500">{[e.degree, e.dateRange || e.dates].filter(Boolean).join(' · ')}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!enriched && (
                        <p className="text-xs text-slate-400 italic">Not yet enriched. Run a Stealth Enrichment campaign to populate this profile.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
