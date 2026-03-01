"use client";

import { useState, useEffect, useRef } from 'react';
import { X, Rocket } from 'lucide-react';

interface CampaignNameModalProps {
    isOpen: boolean;
    defaultName: string;
    onConfirm: (name: string) => void;
    onCancel: () => void;
}

export function CampaignNameModal({ isOpen, defaultName, onConfirm, onCancel }: CampaignNameModalProps) {
    const [name, setName] = useState(defaultName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(defaultName);
            setTimeout(() => inputRef.current?.select(), 50);
        }
    }, [isOpen, defaultName]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(name.trim() || defaultName);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-7 py-5 border-b bg-slate-50/50">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-50 rounded-xl">
                            <Rocket className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Name Your Campaign</h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-7 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Campaign Name
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. LinkedIn Outreach Q1"
                            className="w-full px-5 py-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:ring-0 transition-all text-sm font-bold placeholder:text-slate-300 text-slate-800"
                            autoFocus
                        />
                        <p className="text-[10px] text-slate-400 font-bold">You can rename this later in the campaign builder.</p>
                    </div>

                    <div className="flex space-x-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 py-3.5 rounded-2xl bg-slate-100 font-black text-slate-600 hover:bg-slate-200 transition-colors uppercase text-xs tracking-widest"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                        >
                            Create Campaign
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
