'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { withNetworkRetry, detectInAppBrowser, describeError } from '@/lib/net';
import { Button } from '@/components/ui/button';
import { X, Loader2, MailCheck, AlertCircle, CheckCircle2, Copy } from 'lucide-react';

// Account-recovery modal. Stages:
//   1. CREDS      — collect email + password
//   2. CONNECTING — login is driving; LinkedIn hasn't asked for anything yet
//   3. OTP        — LinkedIn asked for a code, waiting on the user
//   4. VERIFYING  — code handed over, waiting on LinkedIn
//   5. DONE       — success or failure terminal state
//
// Maps 1:1 to the backend recovery flow:
//   POST /session/refresh { email, password }      → returns { requestId }
//   POST /session/otp     { requestId, code }      → wakes the worker
//   GET  /session/refresh-status?requestId=...     → polled from step 2 on
//
// Stage comes from the server's `phase`, never from a local guess. It used to
// jump straight to OTP the moment /refresh returned — before LinkedIn had asked
// for anything — and then, after a code was submitted, keep showing the same
// empty box and warn on a 12s timer that the code looked rejected. A correct
// code was indistinguishable from a wrong one for the ~50s a login takes.

type Stage = 'creds' | 'connecting' | 'otp' | 'verifying' | 'done';
type Phase = 'starting' | 'awaiting_otp' | 'verifying' | 'done';

interface Props {
    open: boolean;
    onClose: () => void;
    defaultEmail?: string;
}

export function OtpRecoveryModal({ open, onClose, defaultEmail }: Props) {
    const [stage, setStage] = useState<Stage>('creds');
    const [email, setEmail] = useState(defaultEmail || '');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [requestId, setRequestId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [otpRejectedHint, setOtpRejectedHint] = useState(false);
    const [inAppBrowser, setInAppBrowser] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => { if (defaultEmail) setEmail(defaultEmail); }, [defaultEmail]);

    // In an effect, not during render — `navigator` doesn't exist while Next
    // server-renders this, and reading it inline would break hydration.
    useEffect(() => {
        if (typeof navigator !== 'undefined') setInAppBrowser(detectInAppBrowser(navigator.userAgent));
    }, []);

    // Reset modal state every time it reopens.
    useEffect(() => {
        if (open) {
            setStage('creds');
            setPassword('');
            setCode('');
            setRequestId(null);
            setError(null);
            setOtpRejectedHint(false);
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
        };
    }, [open]);

    if (!open) return null;

    async function startRefresh() {
        setBusy(true); setError(null);
        try {
            // Safe to retry: the backend holds one refresh slot per account, so a
            // duplicate call re-attaches to the attempt already running and hands
            // back its requestId rather than starting a second login.
            const res = await withNetworkRetry(() => api.post('/session/refresh', { email, password }));
            const id = res.data?.requestId;
            if (!id) throw new Error('No requestId returned');
            setRequestId(id);
            // NOT 'otp' — LinkedIn often completes a refresh without asking for
            // a code at all. Wait for the server to say it was asked.
            setStage('connecting');
            beginPolling(id);
        } catch (e: any) {
            setError(describeError(e, 'Failed to start refresh', inAppBrowser));
        } finally {
            setBusy(false);
        }
    }

    function beginPolling(id: string) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/session/refresh-status?requestId=${encodeURIComponent(id)}`);

                // Mid-flight phases. `attempt` rising above 1 is the server
                // telling us LinkedIn refused the previous code and issued a
                // new one — a fact, replacing the old 12-second guess.
                const phase: Phase = res.data?.phase || 'starting';
                const attempt: number = res.data?.attempt || 1;
                if (res.data?.status !== 'done') {
                    if (phase === 'awaiting_otp') {
                        setStage('otp');
                        if (attempt > 1) {
                            setOtpRejectedHint(true);
                            setCode('');
                        }
                    } else if (phase === 'verifying') {
                        setStage('verifying');
                        setOtpRejectedHint(false);
                    } else {
                        setStage('connecting');
                    }
                }

                if (res.data?.status === 'done') {
                    if (pollRef.current) clearInterval(pollRef.current);
                    pollRef.current = null;
                    const outcome = res.data?.outcome || {};
                    if (outcome.kind === 'success') {
                        setStage('done');
                        setError(null);
                    } else if (outcome.kind === 'otp_failed') {
                        // User exhausted attempts — the request died. They can
                        // close and re-open to try again.
                        setError('Verification failed after multiple attempts. Close and try again.');
                        setStage('done');
                    } else {
                        setError(outcome.error || `Recovery failed: ${outcome.kind || 'unknown'}`);
                        setStage('done');
                    }
                }
            } catch {}
        }, 3000);
    }

    async function submitOtp() {
        if (!requestId || !code) return;
        setBusy(true); setError(null); setOtpRejectedHint(false);
        try {
            await withNetworkRetry(() => api.post('/session/otp', { requestId, code }));
            // Show progress immediately rather than leaving the prompt up while
            // the worker consumes the code — polling will correct this within a
            // tick if the server disagrees. If LinkedIn refuses the code it
            // re-asks, the resolver is called again with a higher `attempt`,
            // and the poll above turns that into the rejection notice.
            setStage('verifying');
            setOtpRejectedHint(false);
            setCode('');
        } catch (e: any) {
            setError(describeError(e, 'Failed to submit code', inAppBrowser));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-lg bg-background shadow-xl border"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b p-4">
                    <h3 className="font-semibold">Re-verify your LinkedIn account</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Warn BEFORE they type a password, not after the submit fails.
                    These webviews are where the OTP POST dies, and the generic
                    "Network Error" gives no clue that the browser is the problem. */}
                {inAppBrowser && stage !== 'done' && (
                    <div className="mx-5 mt-4 flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="text-sm space-y-2">
                            <div className="font-medium">Open this in your normal browser</div>
                            <div className="text-muted-foreground">
                                You&apos;re in {inAppBrowser}&apos;s in-app browser, which often blocks
                                the verification step. Copy the link and paste it into Chrome or Safari.
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(window.location.href);
                                        setLinkCopied(true);
                                        setTimeout(() => setLinkCopied(false), 2500);
                                    } catch { /* clipboard blocked in some webviews — the URL bar still works */ }
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:underline"
                            >
                                {linkCopied ? <><CheckCircle2 className="h-3.5 w-3.5" /> Link copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
                            </button>
                        </div>
                    </div>
                )}

                {stage === 'creds' && (
                    <div className="p-5 space-y-4">
                        <p className="text-sm text-muted-foreground">
                            LinkedIn needs to verify it&apos;s really you. We&apos;ll re-log in
                            through your pinned proxy — if LinkedIn shows a verification
                            code, we&apos;ll ask you to enter it here.
                        </p>
                        <label className="block">
                            <span className="text-sm font-medium">LinkedIn email</span>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium">LinkedIn password</span>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                                autoComplete="current-password"
                            />
                            <span className="mt-1 block text-xs text-muted-foreground">
                                Used once to re-establish the session. Not stored.
                            </span>
                        </label>
                        {error && <ErrorRow text={error} />}
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                            <Button
                                onClick={startRefresh}
                                disabled={busy || !email || !password}
                                className="flex-1"
                            >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
                            </Button>
                        </div>
                    </div>
                )}

                {(stage === 'connecting' || stage === 'verifying') && (
                    <div className="p-5 space-y-4">
                        <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-3">
                            <Loader2 className="h-5 w-5 text-primary mt-0.5 shrink-0 animate-spin" />
                            <div className="text-sm">
                                <div className="font-medium">
                                    {stage === 'connecting' ? 'Signing in to LinkedIn' : 'Verifying your code'}
                                </div>
                                <div className="text-muted-foreground">
                                    {stage === 'connecting'
                                        ? 'This usually takes under a minute. We’ll ask for a code only if LinkedIn requests one.'
                                        : 'LinkedIn is checking the code you entered. Don’t close this window.'}
                                </div>
                            </div>
                        </div>
                        {error && <ErrorRow text={error} />}
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                        </div>
                    </div>
                )}

                {stage === 'otp' && (
                    <div className="p-5 space-y-4">
                        <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-3">
                            <MailCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <div className="text-sm">
                                <div className="font-medium">Check your email</div>
                                <div className="text-muted-foreground">
                                    LinkedIn just sent a 6-digit verification code to{' '}
                                    <span className="font-medium">{email}</span>. Paste it below.
                                </div>
                            </div>
                        </div>
                        <label className="block">
                            <span className="text-sm font-medium">Verification code</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={code}
                                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-center tracking-[0.5em] text-lg font-mono"
                                placeholder="000000"
                                autoFocus
                            />
                        </label>
                        {otpRejectedHint && (
                            <div className="text-xs text-amber-600 flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>
                                    That code wasn’t accepted. LinkedIn has sent a new one —
                                    check your email and enter the latest code.
                                </span>
                            </div>
                        )}
                        {error && <ErrorRow text={error} />}
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                            <Button
                                onClick={submitOtp}
                                disabled={busy || code.length < 4}
                                className="flex-1"
                            >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit code'}
                            </Button>
                        </div>
                    </div>
                )}

                {stage === 'done' && (
                    <div className="p-5 space-y-4">
                        {error ? (
                            <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <div className="font-medium">Recovery failed</div>
                                    <div className="text-muted-foreground">{error}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-3 rounded-md border border-green-500/30 bg-green-500/10 p-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                    <div className="font-medium">All set</div>
                                    <div className="text-muted-foreground">
                                        Your LinkedIn session has been re-established. Campaigns will resume on the next cron tick.
                                    </div>
                                </div>
                            </div>
                        )}
                        <Button onClick={onClose} className="w-full">Done</Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function ErrorRow({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <span className="text-destructive">{text}</span>
        </div>
    );
}
