'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RailItem {
    id: string;
    label: string;
    icon?: string;
    confirmed?: boolean;
}

/**
 * Sticky section navigation with scrollspy. Highlights the section currently in
 * view (IntersectionObserver) and smooth-scrolls on click. Each item shows a
 * confirmed ●/○ dot so the user can see review progress at a glance. Lives in a
 * grid column; the parent makes it sticky.
 */
export function SectionRail({ items, offset = 96 }: { items: RailItem[]; offset?: number }) {
    const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

    useEffect(() => {
        const els = items.map((it) => document.getElementById(`sec-${it.id}`)).filter(Boolean) as HTMLElement[];
        if (!els.length) return;
        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id.replace('sec-', ''));
            },
            { rootMargin: `-${offset}px 0px -55% 0px`, threshold: 0 }
        );
        els.forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, [items, offset]);

    const go = (id: string) => {
        const el = document.getElementById(`sec-${id}`);
        if (!el) return;
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    };

    return (
        <nav className="flex flex-col gap-0.5">
            {items.map((it) => {
                const isActive = active === it.id;
                return (
                    <button
                        key={it.id}
                        onClick={() => go(it.id)}
                        className={cn(
                            'group flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all',
                            isActive ? 'bg-primary/10' : 'hover:bg-slate-100'
                        )}
                    >
                        <span
                            className={cn(
                                'flex h-4 w-4 items-center justify-center rounded-full border text-[8px] transition-colors flex-shrink-0',
                                it.confirmed
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : isActive ? 'border-primary' : 'border-slate-300'
                            )}
                        >
                            {it.confirmed && <Check className="h-2.5 w-2.5" />}
                        </span>
                        <span className={cn('text-sm font-bold truncate', isActive ? 'text-primary' : 'text-slate-600 group-hover:text-slate-900')}>
                            {it.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
