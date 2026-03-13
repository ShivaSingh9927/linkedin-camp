'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Send, Layout, Shield, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success(`Welcome back, ${data.user.email.split('@')[0]}!`);
        router.push('/');
      } else {
        toast.error(data.error || 'Login failed');
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
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
        
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
              <h1 className="text-4xl font-black text-white tracking-tight">WAALAXY CLONE</h1>
            </div>

            <div className="space-y-8">
              <div className="flex items-start space-x-6">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">AI-Powered Campaigns</h3>
                  <p className="text-slate-400 mt-1 leading-relaxed">Scale your LinkedIn outreach with sequences that speak their language.</p>
                </div>
              </div>

              <div className="flex items-start space-x-6">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Ghost Architecture</h3>
                  <p className="text-slate-400 mt-1 leading-relaxed">Your account safety is our priority. Human-like behaviors built in.</p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user${i}`} alt="" />
                    </div>
                  ))}
                </div>
                <span className="text-xs font-bold text-slate-400">Join 10k+ marketers</span>
              </div>
              <p className="text-sm font-medium text-slate-300 italic">"The best automation tool I've used. Saved me 20 hours a week."</p>
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
            <h2 className="text-3xl font-black text-slate-900">Welcome Back</h2>
            <p className="text-slate-500 mt-2 font-medium">Log in to your dashboard to manage campaigns.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                placeholder="shiva@example.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-bold text-slate-700">Password</label>
                <button type="button" className="text-xs font-bold text-primary hover:underline">Forgot Password?</button>
              </div>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                placeholder="••••••••"
              />
            </div>

            <button 
              disabled={loading}
              className="w-full py-4 bg-primary text-white rounded-3xl font-black text-sm shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-400">Don't have an account?</p>
            <Link href="/register" className="text-sm font-bold text-primary hover:underline">Create Account</Link>
          </div>

          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              <span className="font-bold">Important:</span> Only use this tool for research and legitimate networking. Follow LinkedIn's terms of service at all times.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
