'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface BusinessProfile {
    name?: string;
    company?: string;
    persona?: string;
    valueProp?: string;
    style?: string;
    keywords?: string[];
    targetAudience?: string;
    industry?: string;
}

export default function BusinessProfileForm() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [profile, setProfile] = useState<BusinessProfile>({
        name: '',
        company: '',
        persona: '',
        valueProp: '',
        style: '',
        keywords: [],
        targetAudience: '',
        industry: '',
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/v1/users/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.businessProfile) {
                    setProfile(data.businessProfile);
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/v1/users/business-profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(profile),
            });
            if (res.ok) {
                alert('Business profile saved!');
            }
        } catch (error) {
            console.error('Error saving profile:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeywordsChange = (value: string) => {
        const keywords = value.split(',').map(k => k.trim()).filter(Boolean);
        setProfile(prev => ({ ...prev, keywords }));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="bg-white rounded-[2.5rem] border shadow-sm p-8">
                <div className="flex items-center space-x-3 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-purple-500 rounded-2xl flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Business Profile</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Persona & Outreach Settings</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Your Name</label>
                        <input
                            type="text"
                            value={profile.name || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Shiva Singh"
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Company</label>
                        <input
                            type="text"
                            value={profile.company || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, company: e.target.value }))}
                            placeholder="LeadMate"
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-8">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Persona</label>
                        <input
                            type="text"
                            value={profile.persona || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, persona: e.target.value }))}
                            placeholder="AI Engineer & SaaS Founder"
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                        <p className="text-[10px] text-slate-400 ml-1">Who are you? What defines your professional identity?</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Communication Style</label>
                        <input
                            type="text"
                            value={profile.style || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, style: e.target.value }))}
                            placeholder="Direct, insightful, slightly provocative"
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                        <p className="text-[10px] text-slate-400 ml-1">How should AI communicate on your behalf?</p>
                    </div>
                </div>

                <div className="mt-8 space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Value Proposition</label>
                    <textarea
                        value={profile.valueProp || ''}
                        onChange={(e) => setProfile(prev => ({ ...prev, valueProp: e.target.value }))}
                        placeholder="Automating LinkedIn outreach with AI - helping SDRs book more meetings without the manual work"
                        rows={3}
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                    <p className="text-[10px] text-slate-400 ml-1">What do you offer? Why should people connect with you?</p>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-8">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Target Audience</label>
                        <input
                            type="text"
                            value={profile.targetAudience || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, targetAudience: e.target.value }))}
                            placeholder="Sales leaders, SDR managers, Founders"
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Industry</label>
                        <input
                            type="text"
                            value={profile.industry || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, industry: e.target.value }))}
                            placeholder="SaaS / B2B Sales"
                            className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>

                <div className="mt-8 space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Keywords (comma separated)</label>
                    <input
                        type="text"
                        value={profile.keywords?.join(', ') || ''}
                        onChange={(e) => handleKeywordsChange(e.target.value)}
                        placeholder="AI, Automation, Sales, Growth, LinkedIn"
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-[10px] text-slate-400 ml-1">Topics you want to be known for and engage with</p>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center space-x-2 bg-primary text-white px-8 py-4 rounded-2xl text-sm font-black shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all disabled:opacity-50"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        <span>{isSaving ? 'Saving...' : 'Save Business Profile'}</span>
                    </button>
                </div>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-[2.5rem] border border-primary/20 p-8">
                <h4 className="font-black text-slate-900 mb-2">How AI uses this information</h4>
                <p className="text-sm text-slate-600 font-medium">
                    When you enable AI in your campaigns, our system uses this profile to generate personalized 
                    comments and messages that sound like you. The tone, value proposition, and style 
                    settings help maintain authenticity while scaling your outreach.
                </p>
            </div>
        </div>
    );
}
