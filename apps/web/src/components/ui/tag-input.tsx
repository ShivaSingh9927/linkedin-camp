'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Chip/tag editor for list-shaped strategy fields (pain points, advantages,
 * competitors, topics). Type + Enter to add, × or Backspace-on-empty to remove.
 * No JSON — this is what replaces the raw-array editing for non-technical users.
 */
export function TagInput({
    value,
    onChange,
    placeholder = 'Add…',
    tone = 'primary',
    className,
}: {
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    tone?: 'primary' | 'rose' | 'emerald' | 'amber' | 'slate';
    className?: string;
}) {
    const [input, setInput] = useState('');

    const toneCls = {
        primary: 'bg-primary/10 text-primary',
        rose: 'bg-rose-50 text-rose-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        amber: 'bg-amber-50 text-amber-700',
        slate: 'bg-slate-100 text-slate-600',
    }[tone];

    const add = (raw: string) => {
        const v = raw.trim();
        if (!v || value.includes(v)) return;
        onChange([...value, v]);
        setInput('');
    };

    const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-white p-2 transition-all focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary/40',
                className
            )}
        >
            {value.map((tag, i) => (
                <span key={`${tag}-${i}`} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', toneCls)}>
                    {tag}
                    <button type="button" onClick={() => removeAt(i)} className="rounded-full p-0.5 hover:bg-black/10 transition-colors" aria-label={`Remove ${tag}`}>
                        <X className="h-3 w-3" />
                    </button>
                </span>
            ))}
            <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); add(input); }
                    else if (e.key === 'Backspace' && !input && value.length) { e.preventDefault(); removeAt(value.length - 1); }
                }}
                onBlur={() => input.trim() && add(input)}
                placeholder={value.length ? '' : placeholder}
                className="flex-1 min-w-[100px] bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            {input.trim() && (
                <button type="button" onClick={() => add(input)} className="rounded-full p-1 text-primary hover:bg-primary/10 transition-colors" aria-label="Add">
                    <Plus className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}
