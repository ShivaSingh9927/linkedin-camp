'use client';

// The permanent Qampi panel — a built-in right-column card on the dashboard.
// Resting state is quiet (a greeting + "Find leads for me"); it converses inline
// using the same engine as the first-run takeover. Bounded height so it sits in
// the layout and scrolls internally.

import { CopilotConversation } from './CopilotConversation';

export function QampiDashboardPanel() {
    return (
        <div className="bg-card border border-line rounded-card shadow-lift overflow-hidden h-[460px] flex flex-col">
            <CopilotConversation variant="panel" />
        </div>
    );
}
