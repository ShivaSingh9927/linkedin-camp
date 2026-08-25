'use client';

// The permanent Qampi panel — a built-in right-column card on the dashboard.
// Resting state is quiet (a greeting + "Find leads for me"); it converses inline
// using the same engine as the first-run takeover. Bounded height so it sits in
// the layout and scrolls internally.

import { CopilotConversation } from './CopilotConversation';

export function QampiDashboardPanel() {
    return (
        // Fills its grid cell as a full-height rail — the dashboard is a fixed
        // one-window layout, so the panel owns the column height and scrolls its
        // messages internally. A soft (untinted) shadow so it never bleeds over
        // neighbouring cards the way the old sticky + purple lift-shadow did.
        <div className="h-full min-h-[420px]">
            <div className="bg-card border border-line rounded-card shadow-soft overflow-hidden flex flex-col h-full">
                <CopilotConversation variant="panel" />
            </div>
        </div>
    );
}
