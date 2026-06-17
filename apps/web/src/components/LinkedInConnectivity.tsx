'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Linkedin,
    CheckCircle2,
    RefreshCcw,
    AlertCircle,
    Eye,
    EyeOff,
    Zap,
    Lock,
    Smartphone,
    ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { io as socketIO, Socket } from 'socket.io-client';

type LinkStep = 'CREDENTIALS' | 'PROGRESS' | '2FA' | 'SUCCESS';

const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');

export default function LinkedInConnectivity() {
    const [status, setStatus] = useState<{ connected?: boolean; expired?: boolean } | null>(null);
    const [step, setStep] = useState<LinkStep>('CREDENTIALS');
    const [showModal, setShowModal] = useState(false);
    const [mounted, setMounted] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [twoFACode, setTwoFACode] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progressMsg, setProgressMsg] = useState('Initializing secure browser...');

    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        setMounted(true);
        fetchStatus();
        // Poll so the pill flips to red the moment the worker/liveCheck marks
        // the session expired — without needing a page reload.
        const t = setInterval(fetchStatus, 30_000);
        return () => clearInterval(t);
    }, []);

    // Flip to expired immediately on the live SESSION_EXPIRED broadcast (the
    // worker emits this to user_<id> when it detects a dead session), instead
    // of waiting for the next poll.
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        const s = socketIO(apiBase, { transports: ['websocket', 'polling'] });
        s.on('connect', () => s.emit('join_room', { token }));
        s.on('SESSION_EXPIRED', () => setStatus(prev => ({ ...(prev || {}), connected: false, expired: true })));
        return () => { s.disconnect(); };
    }, []);

    // Subscribe to live SESSION_LOGIN_STATUS while the modal is open.
    useEffect(() => {
        if (!showModal) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        const s = socketIO(apiBase, { transports: ['websocket', 'polling'] });
        socketRef.current = s;

        s.on('connect', () => s.emit('join_room', { token }));
        s.on('SESSION_LOGIN_STATUS', (payload: { status?: string; message?: string; error?: string }) => {
            if (payload?.message) setProgressMsg(payload.message);
            else if (payload?.status) setProgressMsg(payload.status);

            if (payload?.status === 'SUCCESS') {
                setStep('SUCCESS');
                fetchStatus();
                toast.success('LinkedIn connected!');
                setLoading(false);
            } else if (payload?.status === 'AWAITING_2FA') {
                setStep('2FA');
                toast.info('Enter the verification code LinkedIn sent you');
                setLoading(false);
            } else if (payload?.status === 'FAILED') {
                setError(payload.error || 'Login failed');
                setStep('CREDENTIALS');
                setLoading(false);
            }
        });

        return () => {
            s.disconnect();
            socketRef.current = null;
        };
    }, [showModal]);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiBase}/api/v1/auth/linkedin-status`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setStatus(data);
            return data;
        } catch {
            return null;
        }
    };

    const handleSubmitCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        setStep('PROGRESS');
        setProgressMsg('Launching headless browser...');

        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

            // 1) Spin up the cloud browser
            const startRes = await fetch(`${apiBase}/api/v1/session/start-socket-login`, {
                method: 'POST',
                headers,
                body: '{}',
            });
            if (!startRes.ok) {
                const j = await startRes.json().catch(() => ({}));
                throw new Error(j.error || 'Failed to start browser');
            }

            // 2) Submit credentials. Backend returns 202 immediately and runs the
            // Playwright login in the background — final outcome arrives over
            // Socket.IO as SESSION_LOGIN_STATUS (SUCCESS / AWAITING_2FA / FAILED).
            const credRes = await fetch(`${apiBase}/api/v1/session/submit-credentials`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ email, password }),
            });
            if (!credRes.ok) {
                const j = await credRes.json().catch(() => ({}));
                throw new Error(j.error || 'Failed to submit credentials');
            }
            setProgressMsg('Logging in to LinkedIn — this may take up to 90 seconds...');
            // Outcome handled by the SESSION_LOGIN_STATUS WS listener above.
        } catch (err: any) {
            setError(err?.message || 'Connection error');
            setStep('CREDENTIALS');
            setLoading(false);
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        setStep('PROGRESS');
        setProgressMsg('Verifying code...');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiBase}/api/v1/session/submit-2fa-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ code: twoFACode }),
            });
            const data = await res.json();
            if (data.success) {
                setStep('SUCCESS');
                fetchStatus();
                toast.success('LinkedIn connected!');
            } else {
                setError(data.error || 'Invalid code');
                setStep('2FA');
            }
        } catch (err: any) {
            setError(err?.message || 'Verification error');
            setStep('2FA');
        } finally {
            setLoading(false);
        }
    };

    const modalContent = (
        <AnimatePresence>
            {showModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => !loading && setShowModal(false)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden border border-border/50 flex flex-col max-h-[95vh]"
                    >
                        <div className="overflow-y-auto scrollbar-hide py-8 px-8 sm:px-12">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-[#0077b5] rounded-xl flex items-center justify-center shadow-lg">
                                        <Linkedin className="w-7 h-7 text-white" />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 leading-none uppercase italic">Cloud Link</h2>
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                {step === 'CREDENTIALS' && (
                                    <motion.form
                                        key="creds"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onSubmit={handleSubmitCredentials}
                                        className="space-y-5"
                                    >
                                        <div className="space-y-2 text-center pb-2">
                                            <h3 className="text-2xl font-black text-slate-900 italic">CONNECT LINKEDIN</h3>
                                            <p className="text-sm text-slate-500 font-medium">
                                                We log into LinkedIn on our cloud browser, then keep your session warm.
                                            </p>
                                        </div>
                                        <div className="space-y-3">
                                            <input
                                                type="email"
                                                required
                                                placeholder="LinkedIn email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full h-14 px-5 rounded-2xl border border-slate-200 focus:outline-none focus:border-[#0077b5] text-sm"
                                            />
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    required
                                                    placeholder="Password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="w-full h-14 px-5 pr-12 rounded-2xl border border-slate-200 focus:outline-none focus:border-[#0077b5] text-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword((v) => !v)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                                >
                                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                        {error && (
                                            <div className="flex items-start space-x-2 p-3 bg-red-50 text-red-600 rounded-2xl text-xs border border-red-100">
                                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                <span>{error}</span>
                                            </div>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase flex items-center justify-center space-x-2 hover:bg-black disabled:opacity-60"
                                        >
                                            <Lock className="w-4 h-4" />
                                            <span>Connect securely</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                        <p className="text-[10px] text-slate-400 text-center font-medium">
                                            Credentials are sent over TLS and used once for browser login. We store the resulting session cookies only.
                                        </p>
                                    </motion.form>
                                )}

                                {step === 'PROGRESS' && (
                                    <motion.div
                                        key="progress"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="py-12 text-center space-y-8"
                                    >
                                        <div className="relative w-24 h-24 mx-auto">
                                            <div className="absolute inset-0 border-4 border-[#0077b5]/20 rounded-full" />
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                                className="absolute inset-0 border-4 border-t-[#0077b5] rounded-full"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <RefreshCcw className="w-8 h-8 text-[#0077b5] animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <h3 className="text-2xl font-black text-slate-900 italic uppercase">Working...</h3>
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-relaxed">
                                                {progressMsg}
                                            </p>
                                            <p className="text-xs text-slate-400">This can take up to 2 minutes if LinkedIn challenges the login.</p>
                                        </div>
                                    </motion.div>
                                )}

                                {step === '2FA' && (
                                    <motion.form
                                        key="2fa"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onSubmit={handleVerify2FA}
                                        className="space-y-5"
                                    >
                                        <div className="space-y-2 text-center pb-2">
                                            <div className="w-16 h-16 mx-auto bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-100">
                                                <Smartphone className="w-8 h-8 text-amber-600" />
                                            </div>
                                            <h3 className="text-2xl font-black text-slate-900 italic">VERIFICATION CODE</h3>
                                            <p className="text-sm text-slate-500 font-medium">
                                                LinkedIn sent a code to your email or phone. Enter it below.
                                            </p>
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            inputMode="numeric"
                                            maxLength={8}
                                            placeholder="000000"
                                            value={twoFACode}
                                            onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                                            className="w-full h-16 px-5 rounded-2xl border border-slate-200 focus:outline-none focus:border-[#0077b5] text-center text-2xl tracking-widest font-mono"
                                        />
                                        {error && (
                                            <div className="flex items-start space-x-2 p-3 bg-red-50 text-red-600 rounded-2xl text-xs border border-red-100">
                                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                <span>{error}</span>
                                            </div>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={loading || twoFACode.length < 4}
                                            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase disabled:opacity-60"
                                        >
                                            Verify
                                        </button>
                                    </motion.form>
                                )}

                                {step === 'SUCCESS' && (
                                    <motion.div key="success" className="py-10 text-center space-y-6">
                                        <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl mx-auto">
                                            <CheckCircle2 className="w-12 h-12 text-white" />
                                        </div>
                                        <h3 className="text-3xl font-black text-slate-900 italic uppercase">Connected</h3>
                                        <p className="text-sm text-slate-500 font-medium">Your LinkedIn session is now live. Campaigns can run.</p>
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className="w-full h-14 bg-slate-900 text-white rounded-[24px] font-black text-sm uppercase"
                                        >
                                            Done
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="relative">
            <button
                onClick={() => {
                    setShowModal(true);
                    setStep('CREDENTIALS');
                    setError(null);
                }}
                className={
                    status?.expired
                        ? 'flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-full border border-red-200 animate-pulse'
                        : status?.connected
                            ? 'flex items-center space-x-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100'
                            : 'flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-full animate-pulse'
                }
            >
                {status?.expired ? (
                    <>
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-[10px] font-black uppercase">Session Expired — Reconnect</span>
                    </>
                ) : status?.connected ? (
                    <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase">Signal Active</span>
                    </>
                ) : (
                    <>
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-black uppercase">Connect LinkedIn</span>
                    </>
                )}
            </button>
            {mounted && createPortal(modalContent, document.body)}
        </div>
    );
}
