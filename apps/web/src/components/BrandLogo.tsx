import * as React from 'react';
import {
    SiGmail,
    SiHubspot,
    SiNotion,
    SiZapier,
    SiIcloud,
    SiZoho,
    SiGooglesheets,
    SiGoogle,
} from 'react-icons/si';
import { cn } from '@/lib/utils';

/**
 * BrandLogo — real brand marks for integrations/providers.
 *
 * Most logos come from Simple Icons (via react-icons/si) rendered in the brand's
 * official colour. A few brands aren't in the open icon set (Microsoft/Yahoo were
 * pulled for trademark reasons; Pipedrive isn't published), so they fall back to a
 * clean brand-coloured monogram — never a broken or wrong logo.
 *
 * To use an *exact* official mark for a fallback brand, drop an SVG at
 * `public/logos/<name>.svg` and add a `custom` entry below pointing at it.
 */

type SiEntry = { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string };

const SIMPLE_ICONS: Record<string, SiEntry> = {
    gmail: { Icon: SiGmail, color: '#EA4335' },
    google: { Icon: SiGoogle, color: '#4285F4' },
    'gmail-oauth': { Icon: SiGmail, color: '#EA4335' },
    hubspot: { Icon: SiHubspot, color: '#FF7A59' },
    notion: { Icon: SiNotion, color: '#0F1117' },
    zapier: { Icon: SiZapier, color: '#FF4F00' },
    icloud: { Icon: SiIcloud, color: '#3693F3' },
    zoho: { Icon: SiZoho, color: '#E42527' },
    googlesheets: { Icon: SiGooglesheets, color: '#34A853' },
};

// Brands not in the open icon set → brand-coloured monogram fallback.
const MONOGRAM: Record<string, { letter: string; color: string }> = {
    pipedrive: { letter: 'P', color: '#017737' },
    outlook: { letter: 'O', color: '#0078D4' },
    microsoft: { letter: 'O', color: '#0078D4' },
    yahoo: { letter: 'Y', color: '#6001D2' },
    custom: { letter: '✦', color: '#7c5cfc' },
};

function normalize(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '').replace('microsoft365', 'microsoft').replace('office365', 'microsoft');
}

export function BrandLogo({ name, className }: { name: string; className?: string }) {
    const key = normalize(name);
    const si = SIMPLE_ICONS[key];
    if (si) {
        const Icon = si.Icon;
        return <Icon className={cn('w-full h-full', className)} style={{ color: si.color }} />;
    }
    const mono = MONOGRAM[key] || { letter: name.charAt(0).toUpperCase() || '?', color: '#5b6172' };
    return (
        <span
            className={cn('grid place-items-center w-full h-full font-bold leading-none', className)}
            style={{ color: mono.color }}
            aria-label={name}
        >
            {mono.letter}
        </span>
    );
}
