'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { X, Loader2, MailCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

// Account-recovery modal. Three stages:
//   1. CREDS  — collect email + password
//   2. OTP    — kicked off recovery, waiting for the user to paste the OTP
//                from their email
//   3. DONE   — success or failure terminal state
//
// Maps 1:1 to the backend recovery flow:
//   POST /session/refresh { email, password }      → returns { requestId }
//   POST /session/otp     { requestId, code }      → wakes the worker
//   GET  /session/refresh-status?requestId=...     → polled by step 2 + 3

type Stage = 'creds' | 'otp' | 'done';

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
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => { if (defaultEmail) setEmail(defaultEmail); }, [defaultEmail]);

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
            const res = await api.post('/session/refresh', { email, password });
            const id = res.data?.requestId;
            if (!id) throw new Error('No requestId returned');
            setRequestId(id);
            setStage('otp');
            beginPolling(id);
        } catch (e: any) {
            setError(e.response?.data?.error || e.message || 'Failed to start refresh');
        } finally {
            setBusy(false);
        }
    }

    function beginPolling(id: string) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/session/refresh-status?requestId=${encodeURIComponent(id)}`);
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
            await api.post('/session/otp', { requestId, code });
            // Worker now consumes the code. If the code was wrong, the worker
            // will re-block on Redis for another code — the request stays
            // running, status stays 'running'. After ~10s of no resolution,
            // surface a soft hint to retry with a new code.
            setTimeout(() => {
                if (stage === 'otp' && pollRef.current) setOtpRejectedHint(true);
            }, 12000);
            setCode('');
        } catch (e: any) {
            setError(e.response?.data?.error || e.message || 'Failed to submit code');
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
                                    Still waiting. If LinkedIn rejected the code, request a new
                                    one and try again.
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
