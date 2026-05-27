'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, Target, PenTool, Globe, Sparkles, Check, Loader2, ArrowRight, Clock } from 'lucide-react';

const tabs = [
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'audience', label: 'Audience', icon: Target },
  { id: 'voice', label: 'Voice', icon: PenTool },
];

const industries = [
  'SaaS/Software', 'Marketing Agency', 'Sales/Recruitment', 'Consulting',
  'E-commerce', 'Real Estate', 'Healthcare', 'Education', 'Finance/Insurance', 'Other'
];

const communicationStyles = [
  { value: 'direct', label: 'Direct', desc: 'Straight to the point, no fluff' },
  { value: 'conversational', label: 'Conversational', desc: 'Friendly and approachable' },
  { value: 'professional', label: 'Professional', desc: 'Formal and polished' },
  { value: 'bold', label: 'Bold', desc: 'Confident and provocative' },
  { value: 'friendly', label: 'Friendly', desc: 'Warm and personable' },
];

const toneOptions = [
  { value: 'no-fluff', label: 'No fluff' },
  { value: 'data-driven', label: 'Data-driven' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'empathetic', label: 'Empathetic' },
];

export default function AIProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('business');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyDescription: '',
    products: '',
    website: '',
    differentiators: '',
    caseStudies: '',
    targetAudience: '',
    industry: '',
    keywords: [] as string[],
    mainPainPoint: '',
    communicationStyle: '',
    writingSamples: [] as { label: string; text: string }[],
    tonePreferences: [] as string[],
  });

  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/users/me');
      const data = await res.json();
      if (data.businessProfile) {
        setExistingProfile(data.businessProfile);
        setForm(prev => ({
          ...prev,
          companyDescription: data.businessProfile.companyDescription || '',
          products: data.businessProfile.products || '',
          website: data.businessProfile.website || '',
          differentiators: data.businessProfile.differentiators || '',
          caseStudies: data.businessProfile.caseStudies || '',
          targetAudience: data.businessProfile.targetAudience || '',
          industry: data.businessProfile.industry || '',
          keywords: data.businessProfile.keywords || [],
          mainPainPoint: data.businessProfile.mainPainPoint || '',
          communicationStyle: data.businessProfile.communicationStyle || '',
          writingSamples: data.businessProfile.writingSamples || [],
          tonePreferences: data.businessProfile.tonePreferences || [],
        }));
      }
    } catch (e) {
      console.error('Failed to load profile', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/users/business-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save', e);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateStrategy = async () => {
    setGenerating(true);
    setRateLimitError(null);
    try {
      const res = await fetch('/api/v1/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      });
      
      if (res.status === 429) {
        const data = await res.json();
        setRateLimitError(data.error || 'Rate limit exceeded. Please wait before generating another strategy.');
        return;
      }
      
      if (res.ok) {
        router.push('/settings/strategy');
      }
    } catch (e) {
      console.error('Failed to generate strategy', e);
      setRateLimitError('Failed to generate strategy. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !form.keywords.includes(keywordInput.trim())) {
      setForm(prev => ({ ...prev, keywords: [...prev.keywords, keywordInput.trim()] }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    setForm(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== kw) }));
  };

  const addWritingSample = () => {
    if (form.writingSamples.length < 5) {
      setForm(prev => ({
        ...prev,
        writingSamples: [...prev.writingSamples, { label: `Sample ${prev.writingSamples.length + 1}`, text: '' }],
      }));
    }
  };

  const updateWritingSample = (index: number, field: 'label' | 'text', value: string) => {
    setForm(prev => {
      const samples = [...prev.writingSamples];
      samples[index] = { ...samples[index], [field]: value };
      return { ...prev, writingSamples: samples };
    });
  };

  const removeWritingSample = (index: number) => {
    setForm(prev => ({
      ...prev,
      writingSamples: prev.writingSamples.filter((_, i) => i !== index),
    }));
  };

  const toggleTone = (tone: string) => {
    setForm(prev => ({
      ...prev,
      tonePreferences: prev.tonePreferences.includes(tone)
        ? prev.tonePreferences.filter(t => t !== tone)
        : [...prev.tonePreferences, tone],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900">AI Profile</h1>
          <p className="mt-2 text-slate-600">
            Help Aigeon understand your business so it can write messages that sound like you.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-white rounded-xl p-1 border border-slate-200 mb-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8">
          {activeTab === 'business' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Company Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.companyDescription}
                  onChange={e => setForm(prev => ({ ...prev, companyDescription: e.target.value }))}
                  placeholder="Describe what your company does in 2-3 sentences..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none h-24 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Products / Services <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.products}
                  onChange={e => setForm(prev => ({ ...prev, products: e.target.value }))}
                  placeholder="List your main products or services, comma-separated..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none h-20 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Website URL
                </label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={form.website}
                    onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://yourcompany.com"
                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">We'll auto-fill fields from your website</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Key Differentiators
                </label>
                <textarea
                  value={form.differentiators}
                  onChange={e => setForm(prev => ({ ...prev, differentiators: e.target.value }))}
                  placeholder="What makes you different from competitors..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none h-20 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Case Studies / Results
                </label>
                <textarea
                  value={form.caseStudies}
                  onChange={e => setForm(prev => ({ ...prev, caseStudies: e.target.value }))}
                  placeholder="Key metrics, results, or testimonials..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none h-20 text-sm"
                />
              </div>
            </div>
          )}

          {activeTab === 'audience' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Target Audience / ICP <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.targetAudience}
                  onChange={e => setForm(prev => ({ ...prev, targetAudience: e.target.value }))}
                  placeholder="Describe your ideal customer profile..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none h-24 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Industry</label>
                <select
                  value={form.industry}
                  onChange={e => setForm(prev => ({ ...prev, industry: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
                >
                  <option value="">Select industry...</option>
                  {industries.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Keywords / Topics</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                    placeholder="Add a keyword..."
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                  />
                  <button
                    onClick={addKeyword}
                    className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.keywords.map(kw => (
                    <span key={kw} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                      {kw}
                      <button onClick={() => removeKeyword(kw)} className="hover:text-primary/70">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Main Pain Point You Solve
                </label>
                <textarea
                  value={form.mainPainPoint}
                  onChange={e => setForm(prev => ({ ...prev, mainPainPoint: e.target.value }))}
                  placeholder="What's the main problem you solve for your customers..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none h-20 text-sm"
                />
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Communication Style <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {communicationStyles.map(style => (
                    <button
                      key={style.value}
                      onClick={() => setForm(prev => ({ ...prev, communicationStyle: style.value }))}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        form.communicationStyle === style.value
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-bold text-sm text-slate-900">{style.label}</p>
                      <p className="text-xs text-slate-500 mt-1">{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  Writing Samples
                </label>
                <p className="text-xs text-slate-500 mb-3">Paste examples of your best emails, posts, or messages. Aigeon will learn your voice.</p>
                
                {form.writingSamples.map((sample, i) => (
                  <div key={i} className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={sample.label}
                        onChange={e => updateWritingSample(i, 'label', e.target.value)}
                        placeholder={`Sample ${i + 1} label`}
                        className="flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                      />
                      {form.writingSamples.length > 1 && (
                        <button onClick={() => removeWritingSample(i)} className="text-slate-400 hover:text-red-500 text-sm">×</button>
                      )}
                    </div>
                    <textarea
                      value={sample.text}
                      onChange={e => {
                        if (e.target.value.length <= 1000) {
                          updateWritingSample(i, 'text', e.target.value);
                        }
                      }}
                      placeholder="Paste your writing sample here..."
                      className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none resize-none h-24"
                    />
                    <p className="text-xs text-slate-400 mt-1 text-right">{sample.text.length}/1000</p>
                  </div>
                ))}

                {form.writingSamples.length < 5 && (
                  <button
                    onClick={addWritingSample}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-semibold text-slate-500 hover:border-primary/30 hover:text-primary transition-colors"
                  >
                    + Add Writing Sample
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">Tone Preferences</label>
                <div className="flex flex-wrap gap-2">
                  {toneOptions.map(tone => (
                    <button
                      key={tone.value}
                      onClick={() => toggleTone(tone.value)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                        form.tonePreferences.includes(tone.value)
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {saved && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-emerald-600 text-sm font-semibold"
                >
                  <Check className="w-4 h-4" />
                  Saved!
                </motion.div>
              )}
              {rateLimitError && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-amber-600 text-sm font-semibold bg-amber-50 px-3 py-1.5 rounded-lg"
                >
                  <Clock className="w-4 h-4" />
                  {rateLimitError}
                </motion.div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                onClick={handleGenerateStrategy}
                disabled={generating || !form.companyDescription || !form.products || !form.targetAudience || !form.communicationStyle}
                className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate AI Strategy
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
