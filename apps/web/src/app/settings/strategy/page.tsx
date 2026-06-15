'use client';

// The strategy view now lives in a reusable component so it can also render as
// a tab inside the AI Profile page. This route is kept as a direct entry point.
import { StrategyWorkspace } from '@/components/StrategyWorkspace';

export default function StrategyPage() {
    return <StrategyWorkspace />;
}
