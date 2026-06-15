import { LoadingScreen } from '@/components/ui';

// Default route loader (dashboard + any route without its own loading.tsx).
// Renders inside SidebarWrapper, so it fills the content area while the
// sidebar/header stay put.
export default function Loading() {
    return <LoadingScreen />;
}
