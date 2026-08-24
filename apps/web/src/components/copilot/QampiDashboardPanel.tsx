'use client';

// The permanent Qampi panel — a built-in right-column card on the dashboard.
// Resting state is quiet (a greeting + "Find leads for me"); it converses inline
// using the same engine as the first-run takeover. Bounded height so it sits in
// the layout and scrolls internally.

import { CopilotConversation } from './CopilotConversation';

export function QampiDashboardPanel() {
    return (
        // Grows with the viewport (floor 520px so it's never cramped, ceiling so it
        // doesn't dwarf the rest of the rail), and sticks in view while the campaigns
        // column scrolls past it.
        <div className="lg:sticky lg:top-6">
            <div className="bg-card border border-line rounded-card shadow-lift overflow-hidden flex flex-col h-[min(72vh,720px)] min-h-[520px]">
                <CopilotConversation variant="panel" />
            </div>
        </div>
    );
}
