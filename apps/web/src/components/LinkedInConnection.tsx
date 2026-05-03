'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Linkedin,
    CheckCircle2,
    RefreshCcw,
    ShieldCheck,
    Lock,
    Eye,
    EyeOff,
    AlertCircle,
    Smartphone,
    Globe,
    Cpu,
    Wifi,
    Clock,
    LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

type LoginStep = 'CREDENTIALS' | 'VERIFICATION' | 'SYNCING' | 'SUCCESS' | 'SESSION_EXPIRED';

export default function LinkedInConnection() {
    const [status, setStatus] = useState<{
        connected: boolean;
        profile?: any;
        sessionInvalid?: boolean;
        sessionValidatedAt?: string;
        reason?: string;
    } | null>(null);
    const [step, setStep] = useState<LoginStep>('CREDENTIALS');
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [twoFACode, setTwoFACode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [relayMessage, setRelayMessage] = useState('Initializing cloud bridge...');
    const [relayStatus, setRelayStatus] = useState<string>('STARTING');
    const [lastValidated, setLastValidated] = useState<string | null>(null);

    const socketRef = useRef<Socket | null>(null);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
            const res = await fetch(`${apiBase}/api/v1/auth/linkedin-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setStatus(data);
            
            if (data.sessionInvalid || data.reason === 'SESSION_EXPIRED') {
                setStep('SESSION_EXPIRED');
                setLastValidated(data.sessionValidatedAt ? new Date(data.sessionValidatedAt).toLocaleString() : null);
            } else if (data.connected) {
                setStep('SUCCESS');
                setLastValidated(data.sessionValidatedAt ? new Date(data.sessionValidatedAt).toLocaleString() : null);
            }
        } catch (error) {
            console.error('Failed to fetch status');
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
            const res = await fetch(`${apiBase}/api/v1/validate-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            
            if (data.valid) {
                toast.success('Session is valid and active');
                setLastValidated(new Date().toLocaleString());
                fetchStatus();
            } else {
                toast.error(`Session expired: ${data.reason}`);
                setStep('SESSION_EXPIRED');
                fetchStatus();
            }
        } catch (err) {
            toast.error('Validation failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();

        const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1\/?$/, '');
        const socket = io(apiBase);
        socketRef.current = socket;

        const token = localStorage.getItem('token');
        if (token) {
            socket.emit('join_room', { token });
        }

        socket.on('SESSION_LOGIN_STATUS', (data: any) => {
            console.log('[SOCKET] Login status:', data);
            setRelayStatus(data.status);
            if (data.message) setRelayMessage(data.message);
            
            if (data.status === 'AWAITING_2FA' || data.status === 'AWAITING_CREDENTIALS') {
                setStep('VERIFICATION');
            } else if (data.status === 'SUCCESS') {
                setStep('SUCCESS');
                fetchStatus();
                toast.success('LinkedIn connected successfully!');
            } else if (data.status === 'FAILED') {
                setError(data.error || 'Connection failed');
                setStep('CREDENTIALS');
            }
        });

        socket.on('SESSION_EXPIRED', (data: any) => {
            console.log('[SOCKET] Session expired:', data);
            setStep('SESSION_EXPIRED');
            toast.error('LinkedIn session expired. Please re-login.');
            fetchStatus();
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handleStartLogin = async () => {
        setError(null);
        setStep('SYNCING');
        setRelayMessage('Requesting cloud instance...');

        try {
            const token = localStorage.getItem('token');
            const socket = socketRef.current;
            if (socket && token) {
                socket.emit('start_socket_login', { token });
            }
        } catch (err) {
            setError('Connection error');
            setStep('CREDENTIALS');
        }
    };

    const handleInitialLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setStep('SYNCING');
        setRelayMessage('Launching browser...');

        await handleStartLogin();
    };

    const handleSubmitCredentials = async () => {
        setStep('SYNCING');
        setRelayMessage('Submitting credentials to cloud browser...');

        try {
            const token = localStorage.getItem('token');
            const socket = socketRef.current;
            if (socket && token) {
                socket.emit('submit_credentials', { token, email, password });
            }
        } catch (err) {
            setError('Connection error');
            setStep('VERIFICATION');
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        setStep('SYNCING');
        setRelayMessage('Verifying security code...');
        try {
            const token = localStorage.getItem('token');
            const socket = socketRef.current;
            if (socket && token) {
                socket.emit('submit_2fa_code', { token, code: twoFACode });
            }
        } catch (err) {
            setError('Sync error');
            setStep('VERIFICATION');
        }
    };

    const handleReconnect = async () => {
        setTwoFACode('');
        setError(null);
        setEmail('');
        setPassword('');
        setStep('CREDENTIALS');
        await handleStartLogin();
    };

    const formatTimeAgo = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${Math.floor(diffHours / 24)}d ago`;
    };

    if (loading) return (
        <div className="h-64 flex items-center justify-center">
            <RefreshCcw className="w-8 h-8 text-primary animate-spin" />
        </div>
    );

    return (
        <div className="max-w-xl mx-auto space-y-8">
            <div className="bg-white rounded-[2.5rem] border shadow-2xl shadow-slate-200/50 overflow-hidden">
                <AnimatePresence mode="wait">
                    {step === 'SUCCESS' ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-12 text-center space-y-6"
                        >
                            <div className="relative inline-block">
                                <div className="w-24 h-24 bg-[#0077b5] rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-[#0077b5]/30">
                                    <Linkedin className="w-12 h-12 text-white" />
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-accent rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
                                    <CheckCircle2 className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-slate-900">Synchronized!</h2>
                                <p className="text-slate-500 font-medium">Your account is now guarded by a Dedicated ISP Proxy.</p>
                            </div>
                            {lastValidated && (
                                <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                                    <Clock className="w-4 h-4" />
                                    <span>Last validated: {formatTimeAgo(lastValidated)}</span>
                                </div>
                            )}
                            <div className="flex justify-center gap-3 pt-4">
                                <button
                                    onClick={handleValidate}
                                    className="px-5 py-2.5 bg-blue-50 text-blue-600 rounded-2xl flex items-center gap-2 text-sm font-bold hover:bg-blue-100 transition-colors"
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    Validate
                                </button>
                                <button
                                    onClick={() => setStep('SESSION_EXPIRED')}
                                    className="px-5 py-2.5 bg-slate-50 text-slate-600 rounded-2xl flex items-center gap-2 text-sm font-bold hover:bg-slate-100 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Re-login
                                </button>
                            </div>
                        </motion.div>
                    ) : step === 'SESSION_EXPIRED' ? (
                        <motion.div
                            key="expired"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-12 text-center space-y-6"
                        >
                            <div className="relative inline-block">
                                <div className="w-24 h-24 bg-red-100 rounded-3xl mx-auto flex items-center justify-center">
                                    <AlertCircle className="w-12 h-12 text-red-500" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-slate-900">Session Expired</h2>
                                <p className="text-slate-500 font-medium">Your LinkedIn session has expired. Re-login to resume campaigns.</p>
                            </div>
                            {lastValidated && (
                                <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                                    <Clock className="w-4 h-4" />
                                    <span>Last validated: {formatTimeAgo(lastValidated)}</span>
                                </div>
                            )}
                            <button
                                onClick={handleReconnect}
                                className="w-full bg-[#0077b5] text-white py-4 rounded-full font-bold text-lg shadow-xl shadow-[#0077b5]/20 hover:bg-[#006396] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <Globe className="w-5 h-5" />
                                Re-connect
                            </button>
                        </motion.div>
                    ) : (
                        <div className="contents">
                            <div className="p-8 pb-4 flex flex-col items-center">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="w-10 h-10 bg-[#0077b5] rounded-xl flex items-center justify-center shadow-lg shadow-[#0077b5]/20">
                                        <Linkedin className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="text-2xl font-black text-[#0077b5] tracking-tight">CloudSync</span>
                                </div>
                                <h1 className="text-2xl font-bold text-slate-900 text-center">
                                    {step === 'CREDENTIALS' && 'Infinite Cloud Login'}
                                    {step === 'VERIFICATION' && 'Security Challenge'}
                                    {step === 'SYNCING' && 'Relaying Session...'}
                                </h1>
                                <p className="text-slate-500 text-sm mt-2 text-center max-w-[80%]">
                                    {step === 'CREDENTIALS' && "Establish a professional, server-side connection that stays alive 24/7."}
                                    {step === 'VERIFICATION' && "A security code was sent to your email. We are waiting to relay it to the cloud browser."}
                                    {step === 'SYNCING' && relayMessage}
                                </p>
                            </div>

                            <div className="p-12 pt-4">
                                <AnimatePresence mode="wait">
                                    {step === 'CREDENTIALS' && (
                                        <motion.form
                                            key="login"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            onSubmit={handleInitialLogin}
                                            className="space-y-5"
                                        >
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <input
                                                        type="email"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#0077b5] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
                                                        placeholder="LinkedIn Email"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <input
                                                            type={showPassword ? "text" : "password"}
                                                            value={password}
                                                            onChange={(e) => setPassword(e.target.value)}
                                                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#0077b5] focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
                                                            placeholder="Password"
                                                            required
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0077b5] transition-colors"
                                                        >
                                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {error && (
                                                <div className="p-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {error}
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                className="w-full bg-[#0077b5] text-white py-4 rounded-full font-bold text-lg shadow-xl shadow-[#0077b5]/20 hover:bg-[#006396] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                            >
                                                <Globe className="w-5 h-5" />
                                                Launch Cloud Instance
                                            </button>

                                            <div className="flex items-center gap-4 pt-2">
                                                <div className="flex-1 h-px bg-slate-100" />
                                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Enterprise Features</span>
                                                <div className="flex-1 h-px bg-slate-100" />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center gap-1">
                                                    <Wifi className="w-4 h-4 text-accent" />
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Static ISP</span>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center gap-1">
                                                    <Cpu className="w-4 h-4 text-accent" />
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">24/7 Heartbeat</span>
                                                </div>
                                            </div>
                                        </motion.form>
                                    )}

                                    {step === 'VERIFICATION' && relayStatus === 'AWAITING_CREDENTIALS' ? (
                                        <motion.div
                                            key="submit-creds"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="space-y-6"
                                        >
                                            <div className="flex flex-col items-center space-y-4">
                                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                                                    <Globe className="w-8 h-8 text-[#0077b5]" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-slate-700">Browser Ready</p>
                                                    <p className="text-xs text-slate-500">Click below to submit credentials to the cloud browser</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSubmitCredentials}
                                                className="w-full bg-[#0077b5] text-white py-4 rounded-full font-bold text-lg shadow-xl shadow-[#0077b5]/20 hover:bg-[#006396] transition-all"
                                            >
                                                Submit Credentials
                                            </button>
                                        </motion.div>
                                    ) : step === 'VERIFICATION' ? (
                                        <motion.form
                                            key="2fa"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            onSubmit={handleVerify2FA}
                                            className="space-y-6"
                                        >
                                            <div className="flex flex-col items-center space-y-4">
                                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center relative">
                                                    <Smartphone className="w-8 h-8 text-[#0077b5]" />
                                                    <div className="absolute top-0 right-0 w-4 h-4 bg-accent rounded-full animate-ping" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-slate-700">Relay Required</p>
                                                    <p className="text-xs text-slate-500 italic">"Our browser is stuck at the gate. Give us the key."</p>
                                                </div>
                                            </div>

                                            <input
                                                type="text"
                                                maxLength={6}
                                                value={twoFACode}
                                                onChange={(e) => setTwoFACode(e.target.value)}
                                                placeholder="000000"
                                                className="w-full text-center text-4xl tracking-[0.5em] font-black py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#0077b5] focus:bg-white outline-none transition-all"
                                                required
                                            />

                                            {error && (
                                                <div className="p-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {error}
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                className="w-full bg-[#0077b5] text-white py-4 rounded-full font-bold text-lg shadow-xl shadow-[#0077b5]/20 hover:bg-[#006396] transition-all"
                                            >
                                                Submit to Cloud
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setStep('CREDENTIALS')}
                                                className="w-full text-sm font-bold text-slate-400 hover:text-[#0077b5] transition-colors"
                                            >
                                                Reset Connection
                                            </button>
                                        </motion.form>
                                    ) : null}

                                    {step === 'SYNCING' && (
                                        <motion.div
                                            key="syncing"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="py-12 flex flex-col items-center space-y-6"
                                        >
                                            <div className="relative">
                                                <div className="w-24 h-24 border-4 border-[#0077b5]/10 border-t-[#0077b5] rounded-full animate-spin" />
                                                <div className="absolute inset-0 m-auto w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                                                    <RefreshCcw className="w-7 h-7 text-[#0077b5] animate-pulse" />
                                                </div>
                                                <div className="absolute -bottom-2 -left-2 bg-accent text-white p-2 rounded-xl shadow-lg">
                                                    <Globe className="w-4 h-4" />
                                                </div>
                                            </div>
                                            <div className="text-center space-y-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                                    <p className="font-bold text-slate-700 uppercase tracking-[0.2em] text-xs">{relayStatus}</p>
                                                </div>
                                                <p className="text-sm text-slate-500 font-medium">{relayMessage}</p>
                                                <div className="pt-4 flex gap-1 justify-center">
                                                    {[1,2,3,4,5].map(i => (
                                                        <div key={i} className={`h-1 w-8 rounded-full ${relayStatus === 'SUCCESS' ? 'bg-green-500' : 'bg-slate-100 animate-pulse'}`} style={{ animationDelay: `${i * 0.2}s` }} />
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex items-center justify-center gap-2 text-slate-400">
                <Lock className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Military-Grade Encryption (AES-256)</span>
            </div>
        </div>
    );
}
