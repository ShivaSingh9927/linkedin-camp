'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
    User, 
    Briefcase, 
    Linkedin, 
    Globe, 
    Target, 
    FileText, 
    MessageSquare, 
    ChevronRight, 
    Check,
    Loader2,
    Building2,
    Search,
    Users,
    ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        jobTitle: '',
        linkedinUrl: '',
        company: '',
        website: '',
        targetAudience: '',
        mainPainPoint: '',
        valueProp: '',
        heardFrom: '',
        industry: ''
    });
    const [showCustomIndustry, setShowCustomIndustry] = useState(false);

    const INDUSTRIES = [
        'SaaS / Software',
        'Marketing Agency',
        'Sales / Recruitment',
        'Consulting',
        'E-commerce',
        'Real Estate',
        'Healthcare',
        'Education',
        'Finance / Insurance',
        'Other'
    ];

    const [customIndustry, setCustomIndustry] = useState('');

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            setFormData(prev => ({
                ...prev,
                firstName: parsed.firstName || '',
                lastName: parsed.lastName || '',
            }));
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'industry') {
            setShowCustomIndustry(value === 'Other');
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNext = () => {
        if (step === 1 && !formData.jobTitle) {
            toast.error('Please enter your job title');
            return;
        }
        setStep(2);
    };

    const handleSubmit = async (isSkipping = false) => {
        if (!isSkipping && !formData.linkedinUrl) {
            toast.error('LinkedIn Profile URL is required for automation');
            return;
        }

        setLoading(true);
        try {
            const finalIndustry = formData.industry === 'Other' ? customIndustry : formData.industry;
            const payload = isSkipping 
                ? { ...formData, company: '', website: '', targetAudience: '', mainPainPoint: '', valueProp: '', heardFrom: '', industry: '' }
                : { ...formData, industry: finalIndustry };

            const { data } = await api.put('/users/onboarding', payload);
            
            // Update local user state
            const updatedUser = { ...user, registrationStep: 'COMPLETED' };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            toast.success('Onboarding completed! Welcome to Leadmate.');
            router.push('/');
        } catch (error: any) {
            console.error('Onboarding submission error:', error);
            toast.error(error.response?.data?.error || 'Failed to complete onboarding');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                         <img src="/leadmate_wbg.png" alt="Logo" className="w-14 h-14 object-contain animate-in zoom-in duration-1000" />
                    </div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight sm:text-4xl">Setup Your Success</h1>
                    <p className="text-muted-foreground font-medium mt-2">Just a few details to get your LinkedIn automation running perfectly.</p>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center justify-between mb-12 px-4">
                    {[1, 2].map((i) => (
                        <React.Fragment key={i}>
                            <div className="flex flex-col items-center gap-2">
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center font-black transition-all duration-500 border-2",
                                    step >= i ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-white border-slate-200 text-slate-400"
                                )}>
                                    {step > i ? <Check className="w-5 h-5" /> : i}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest",
                                    step >= i ? "text-primary" : "text-slate-400"
                                )}>
                                    {i === 1 ? 'Identity' : 'Strategy'}
                                </span>
                            </div>
                            {i < 2 && (
                                <div className="flex-1 h-0.5 mx-4 bg-slate-200 relative overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: step > 1 ? '100%' : '0%' }}
                                        className="absolute inset-0 bg-primary"
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Form Container */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 p-8 sm:p-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
                    
                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-6">
                                    <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-3">
                                        <User className="w-6 h-6 text-primary" />
                                        Step 1: Who are you?
                                    </h2>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">First Name</label>
                                            <div className="group relative">
                                                <input 
                                                    name="firstName"
                                                    value={formData.firstName}
                                                    onChange={handleChange}
                                                    readOnly
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all text-slate-500 cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Last Name</label>
                                            <div className="group relative">
                                                <input 
                                                    name="lastName"
                                                    value={formData.lastName}
                                                    onChange={handleChange}
                                                    readOnly
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all text-slate-500 cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                                            Current Job Title <span className="text-red-500">*</span>
                                        </label>
                                        <div className="group relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                <Briefcase className="w-5 h-5" />
                                            </div>
                                            <input 
                                                name="jobTitle"
                                                placeholder="e.g. Sales Manager, Founder, SDR"
                                                value={formData.jobTitle}
                                                onChange={handleChange}
                                                className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleNext}
                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-2xl font-black shadow-xl shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                                >
                                    <span>Continue to Strategy</span>
                                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-3">
                                            <Target className="w-6 h-6 text-primary" />
                                            Step 2: Strategy & Sync
                                        </h2>
                                        <div className="bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/10">
                                            90% Boost with AI Strategy
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                                            Your LinkedIn Profile URL <span className="text-red-500">*</span>
                                        </label>
                                        <div className="group relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                <Linkedin className="w-5 h-5" />
                                            </div>
                                            <input 
                                                name="linkedinUrl"
                                                placeholder="https://www.linkedin.com/in/username"
                                                value={formData.linkedinUrl}
                                                onChange={handleChange}
                                                className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm"
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-bold px-1">Essential for the AI to understand your profile and sync leads correctly.</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Company Name</label>
                                            <div className="group relative">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <input 
                                                    name="company"
                                                    placeholder="e.g. Acme Corp"
                                                    value={formData.company}
                                                    onChange={handleChange}
                                                    className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Company Website</label>
                                            <div className="group relative">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                    <Globe className="w-5 h-5" />
                                                </div>
                                                <input 
                                                    name="website"
                                                    placeholder="https://example.com"
                                                    value={formData.website}
                                                    onChange={handleChange}
                                                    className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-0">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Industry / Business Type</label>
                                            <div className="group relative">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors z-10 pointer-events-none">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <select 
                                                    name="industry"
                                                    value={formData.industry}
                                                    onChange={handleChange}
                                                    className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 pr-10 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm appearance-none cursor-pointer"
                                                >
                                                    <option value="" disabled>Select Industry</option>
                                                    {INDUSTRIES.map(ind => (
                                                        <option key={ind} value={ind}>{ind}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                                    <ChevronDown className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Target Audience (ICP)</label>
                                            <div className="group relative">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                    <Users className="w-5 h-5" />
                                                </div>
                                                <input 
                                                    name="targetAudience"
                                                    placeholder="e.g. Sales Leaders, Founders"
                                                    value={formData.targetAudience}
                                                    onChange={handleChange}
                                                    className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {showCustomIndustry && (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                className="space-y-2 overflow-hidden"
                                            >
                                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Specify Your Industry</label>
                                                <div className="group relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <input 
                                                        placeholder="Enter your industry type"
                                                        value={customIndustry}
                                                        onChange={(e) => setCustomIndustry(e.target.value)}
                                                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="space-y-2 pt-2">
                                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-1">Where did you hear about us?</label>
                                        <div className="group relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                                                <Search className="w-5 h-5" />
                                            </div>
                                            <input 
                                                name="heardFrom"
                                                placeholder="LinkedIn, Friend, Advertisment..."
                                                value={formData.heardFrom}
                                                onChange={handleChange}
                                                className="w-full bg-white border border-slate-200 rounded-2xl p-4 pl-12 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                    <button 
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="sm:w-32 bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black transition-all active:scale-[0.98]"
                                    >
                                        Back
                                    </button>
                                    <button 
                                        onClick={() => handleSubmit(false)}
                                        disabled={loading}
                                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-2xl font-black shadow-xl shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                            <>
                                                <span>Complete Onboarding</span>
                                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="text-center">
                                    <button 
                                        onClick={() => handleSubmit(true)}
                                        disabled={loading}
                                        className="text-xs font-black text-muted-foreground hover:text-primary uppercase tracking-widest transition-colors p-2"
                                    >
                                        Skip GTM & Start Setup
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <p className="text-center mt-12 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-50">
                    Leadmate AI &copy; 2026 • Powered by Cloud Simulations
                </p>
            </div>
        </div>
    );
}
