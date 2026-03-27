"use client";

import { useState, useRef, useEffect } from 'react';
import { Tag, Plus, X, Search, Loader2, Check } from 'lucide-react';
import api from '@/lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ProspectTagPickerProps {
    leadId: string;
    currentTags: string[];
    allAvailableTags: string[];
    onTagsUpdated: (newTags: string[]) => void;
}

export default function ProspectTagPicker({ 
    leadId, 
    currentTags = [], 
    allAvailableTags = [], 
    onTagsUpdated 
}: ProspectTagPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    const toggleTag = async (tag: string) => {
        setLoading(true);
        try {
            let newTags = [...currentTags];
            if (newTags.includes(tag)) {
                newTags = newTags.filter(t => t !== tag);
            } else {
                newTags.push(tag);
            }
            
            await api.patch(`/leads/${leadId}/tags`, { tags: newTags });
            onTagsUpdated(newTags);
        } catch (error) {
            console.error('Failed to update tag:', error);
        } finally {
            setLoading(false);
        }
    };

    const createNewTag = async () => {
        const trimmed = search.trim();
        if (!trimmed || currentTags.includes(trimmed)) return;
        
        await toggleTag(trimmed);
        setSearch('');
    };

    const filteredTags = allAvailableTags.filter(t => 
        t.toLowerCase().includes(search.toLowerCase())
    );

    const showCreateAction = search.trim() !== '' && !allAvailableTags.some(t => t.toLowerCase() === search.trim().toLowerCase());

    return (
        <div className="relative inline-block" ref={popoverRef}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-white hover:bg-muted transition-all shadow-sm",
                    isOpen && "border-primary/40 bg-primary/5 text-primary"
                )}
            >
                <Plus className="w-4 h-4" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-background border border-border rounded-3xl shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                autoFocus
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && createNewTag()}
                                placeholder="Search or create segment..."
                                className="w-full pl-9 pr-3 py-2.5 bg-muted/30 border border-border rounded-xl text-[11px] font-bold focus:outline-none focus:border-primary/30 transition-all font-mono"
                            />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-hide">
                            {filteredTags.map(tag => {
                                const isSelected = currentTags.includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        onClick={(e) => { e.stopPropagation(); toggleTag(tag); }}
                                        disabled={loading}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                            isSelected 
                                                ? "bg-primary/10 text-primary" 
                                                : "text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        <span className="truncate">{tag}</span>
                                        {isSelected && <Check className="w-3 h-3" />}
                                    </button>
                                );
                            })}

                            {showCreateAction && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); createNewTag(); }}
                                    disabled={loading}
                                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all uppercase tracking-widest border border-dashed border-indigo-200"
                                >
                                    <Plus className="w-3 h-3 text-indigo-500" />
                                    <span>Create "{search.trim()}"</span>
                                </button>
                            )}

                            {filteredTags.length === 0 && !showCreateAction && (
                                <div className="py-8 text-center opacity-40">
                                    <Tag className="w-6 h-6 mx-auto mb-2" />
                                    <p className="text-[9px] font-black uppercase tracking-[0.15em]">No segments found</p>
                                </div>
                            )}
                        </div>

                        {loading && (
                            <div className="flex justify-center pt-2">
                                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
