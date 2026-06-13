'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Target, Users, Lightbulb, FileText } from 'lucide-react';
import { io as socketIO, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import Link from 'next/link';
import api from '@/lib/api';

const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');

/**
 * "Here's what Qampi figured out about you" — a confident, digestible jist of
 * what the AI has learned, surfaced on the dashboard. Backed by two sources:
 *  - the self-profile enrichment summary (from the user's own LinkedIn profile
 *    + recent posts), which appears as soon as enrichment completes, and
 *  - the full AI strategy (positioning / ICP / pillars), once generated.
 * It's a teaser: the full strategy lives at /settings/strategy.
 */
export function AIInsightSummary() {
  const [strategy, setStrategy] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [justEnriched, setJustEnriched] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.get('/strategy'), api.get('/users/me')]).then(([s, m]) => {
      if (cancelled) return;
      if (s.status === 'fulfilled') setStrategy(s.value.data?.strategy || null);
      if (m.status === 'fulfilled') setProfile(m.value.data?.businessProfile || null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live reveal: when self-enrichment finishes (right after the user connects
  // LinkedIn), the backend emits SELF_PROFILE_ENRICHED. Drop the summary in
  // immediately and flag it so the card animates a "just studied your profile"
  // moment, instead of the insight silently appearing on the next page load.
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const s = socketIO(apiBase, { transports: ['websocket', 'polling'] });
    socketRef.current = s;
    s.on('connect', () => s.emit('join_room', { token }));
    s.on('SELF_PROFILE_ENRICHED', (payload: { summary?: string; communicationStyle?: string; tonePreferences?: string[] }) => {
      if (!payload?.summary) return;
      setProfile((prev: any) => ({
        ...(prev || {}),
        selfProfileSummary: payload.summary,
        communicationStyle: prev?.communicationStyle || payload.communicationStyle,
        tonePreferences: (prev?.tonePreferences?.length ? prev.tonePreferences : payload.tonePreferences) || [],
      }));
      setJustEnriched(true);
      toast.success('✨ I just studied your LinkedIn profile', {
        description: "Here's what I learned about you.",
      });
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const positioning: string | undefined = strategy?.gtm?.positioning;
  const icp = strategy?.icp?.primary || {};
  const icpTitle: string | undefined = icp?.title;
  const painPoints: string[] = Array.isArray(icp?.painPoints) ? icp.painPoints.slice(0, 3) : [];
  const topPillar = Array.isArray(strategy?.messagingPillars) ? strategy.messagingPillars[0] : null;

  // A fallback strategy is generic boilerplate (it describes Qampi, not the
  // user), so we don't treat it as personalized.
  const hasStrategy = !!positioning && !strategy?._metadata?.isFallback;

  // Self-profile enrichment results.
  const selfSummary: string | undefined = profile?.selfProfileSummary || undefined;
  const postCount: number = Array.isArray(profile?.selfRecentPosts) ? profile.selfRecentPosts.length : 0;

  // The lead paragraph: prefer the strategy positioning; fall back to the
  // self-profile summary so the card can appear right after enrichment, before
  // a full strategy is generated.
  const lead: string | undefined = hasStrategy ? positioning : selfSummary;

  if (loading || !lead) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border bg-gradient-to-br from-primary/5 via-indigo-50/50 to-purple-50/40 p-6 sm:p-8 shadow-soft transition-shadow ${justEnriched ? 'border-primary/40 ring-2 ring-primary/20' : 'border-primary/20'}`}
    >
      <Sparkles className="absolute -right-6 -top-6 w-32 h-32 text-primary/5" />

      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black text-foreground tracking-tight">
              Here&apos;s what I&apos;ve learned about you
            </h3>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {justEnriched ? 'Just studied your profile' : hasStrategy ? 'AI strategy · the jist' : 'From your LinkedIn profile'}
            </p>
          </div>
        </div>

        <p className="text-sm sm:text-base font-bold text-foreground/90 leading-relaxed mb-5">
          {lead}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {hasStrategy && icpTitle && (
            <div className="flex items-start gap-3 bg-white/60 rounded-2xl p-3.5 border border-white">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">You target</p>
                <p className="text-sm font-black text-foreground truncate">{icpTitle}</p>
              </div>
            </div>
          )}

          {hasStrategy && topPillar?.pillar && (
            <div className="flex items-start gap-3 bg-white/60 rounded-2xl p-3.5 border border-white">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Your edge</p>
                <p className="text-sm font-black text-foreground truncate">{topPillar.pillar}</p>
              </div>
            </div>
          )}
        </div>

        {hasStrategy && painPoints.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2.5">
              <Target className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Pains you solve
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {painPoints.map((p, i) => (
                <span
                  key={i}
                  className="text-xs font-bold text-foreground/80 bg-white/70 border border-white px-3 py-1.5 rounded-full"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {hasStrategy && (
            <Link
              href="/settings/strategy"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-2xl text-sm font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:scale-95 group"
            >
              See the full picture
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}

          {postCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              Learned from your profile and your last {postCount} {postCount === 1 ? 'post' : 'posts'}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
