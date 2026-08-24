'use client';

// Full-screen first-run takeover. Rendered by the dashboard the first time a
// freshly-connected user lands with no leads and no campaigns (see page.tsx gate).
// Dismissing ("Skip for now") sets a local flag so it doesn't reappear; the same
// conversation then lives on as the permanent dashboard panel.

import { motion } from 'framer-motion';
import { CopilotConversation } from './CopilotConversation';

export const ACTIVATION_DISMISSED_KEY = 'qampi.activation.dismissed';

export function ActivationCopilot({ onDismiss }: { onDismiss: () => void }) {
    const dismiss = () => {
        try { localStorage.setItem(ACTIVATION_DISMISSED_KEY, '1'); } catch { /* ignore */ }
        onDismiss();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm p-3 sm:p-6"
        >
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="w-full max-w-2xl h-[88vh] sm:h-[84vh] bg-surface rounded-card border border-line shadow-lift overflow-hidden flex flex-col"
            >
                <CopilotConversation variant="fullscreen" onClose={dismiss} />
            </motion.div>
        </motion.div>
    );
}
