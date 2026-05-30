'use client';

import IntegrationsSettings from '@/components/IntegrationsSettings';
import { TopBar } from '@/components/TopBar';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function IntegrationsPage() {
    return (
        <div className="min-h-full bg-slate-50 flex flex-col">
            <TopBar
                title="CRM & Integrations"
                description="Configure your HubSpot, Pipedrive, Notion, and Custom Webhook connections."
                action={
                    <Link
                        href="/settings"
                        className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 transition-all active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Settings</span>
                    </Link>
                }
            />

            <div className="flex-1 p-8">
                <IntegrationsSettings />
            </div>
        </div>
    );
}
