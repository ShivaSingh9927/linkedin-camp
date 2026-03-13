'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Send, Rocket, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success('Account created successfully!');
        router.push('/');
      } else {
        toast.error(data.error || 'Registration failed');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex overflow-hidden">
      {/* Left side - Visuals */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-emerald-500/10 opacity-50" />
        
        <div className="relative z-10 w-full max-w-lg">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-primary rounded-[2rem] flex items-center justify-center shadow-2xl shadow-primary/40 rotate-6">
                <Send className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tight">SALES BOT</h1>
            </div>

            <div className="space-y-10">
                <h2 className="text-5xl font-black text-white leading-tight">
                    Start your journey to <span className="text-primary italic">massively scale</span> your pipeline.
                </h2>

                <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10">
                        <Rocket className="w-8 h-8 text-primary mb-4" />
                        <h4 className="font-bold text-white">Scale Fast</h4>
                        <p className="text-xs text-slate-400 mt-1">Connect with hundreds of leads daily.</p>
                    </div>
                    <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-4" />
                        <h4 className="font-bold text-white">Safe & Secure</h4>
                        <p className="text-xs text-slate-400 mt-1">Cloud-based automation logic.</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-primary/20 rounded-2xl border border-primary/30">
                <Shield className="w-6 h-6 text-primary flex-shrink-0" />
                <p className="text-xs font-bold text-slate-300">
                    GDPR Compliant and Built with safety limits to protect your LinkedIn account reputation.
                </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-50 lg:bg-white">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md space-y-10"
        >
          <div>
            <h2 className="text-3xl font-black text-slate-900 lowercase tracking-tighter">Create/account</h2>
            <p className="text-slate-500 mt-2 font-bold text-sm uppercase tracking-widest">Get started in seconds</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Work Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-bold placeholder:text-slate-400"
                placeholder="shiva@company.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Secure Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-bold placeholder:text-slate-400"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center space-x-3 p-1">
                <input type="checkbox" required className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary" />
                <span className="text-xs font-bold text-slate-500">I agree to the <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link></span>
            </div>

            <button 
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white rounded-3xl font-black text-sm shadow-2xl shadow-slate-900/10 hover:shadow-slate-900/20 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Initialize Access'}
            </button>
          </form>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-400">Existing user?</p>
            <Link href="/login" className="text-sm font-bold text-primary hover:bg-primary/5 px-4 py-2 rounded-xl border border-transparent hover:border-primary/10 transition-all">
                Login instead
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
