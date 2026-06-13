'use client';

import { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Click-to-edit text. Renders as styled read text until clicked, then becomes
 * an input/textarea that commits on blur or Enter (Esc cancels). This is the
 * plain-text editing that replaces the JSON editor for sentence-shaped fields
 * (positioning, value prop, descriptions, objection responses…).
 */
export function EditableText({
    value,
    onCommit,
    multiline = false,
    placeholder = 'Click to add…',
    className,
    readClassName,
}: {
    value: string;
    onCommit: (next: string) => void;
    multiline?: boolean;
    placeholder?: string;
    className?: string;
    readClassName?: string;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

    useEffect(() => { setDraft(value); }, [value]);
    useEffect(() => {
        if (editing && ref.current) {
            ref.current.focus();
            const len = ref.current.value.length;
            ref.current.setSelectionRange(len, len);
        }
    }, [editing]);

    const commit = () => {
        setEditing(false);
        const trimmed = draft.trim();
        if (trimmed !== (value || '').trim()) onCommit(trimmed);
    };

    if (editing) {
        const shared = {
            ref: ref as any,
            value: draft,
            onChange: (e: any) => setDraft(e.target.value),
            onBlur: commit,
            onKeyDown: (e: any) => {
                if (e.key === 'Escape') { setDraft(value); setEditing(false); }
                else if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
                else if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
            },
            placeholder,
            className: cn(
                'w-full rounded-xl border border-primary/40 bg-white px-3 py-2 text-sm outline-none ring-4 ring-primary/10 resize-none',
                className
            ),
        };
        return multiline ? <textarea {...shared} rows={3} /> : <input {...shared} />;
    }

    return (
        <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
                'group/edit relative w-full text-left rounded-xl px-3 py-2 -mx-3 -my-2 hover:bg-slate-50 transition-colors',
                readClassName
            )}
        >
            {value
                ? <span className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{value}</span>
                : <span className="text-sm text-muted-foreground italic">{placeholder}</span>}
            <Pencil className="inline-block w-3 h-3 text-slate-300 ml-1.5 align-middle opacity-0 group-hover/edit:opacity-100 transition-opacity" />
        </button>
    );
}
