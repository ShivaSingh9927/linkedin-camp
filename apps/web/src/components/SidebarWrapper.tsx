"use client";

import { usePathname } from 'next/navigation';
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuthPage = pathname === '/login' || pathname === '/register';

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <div className="flex items-center justify-end px-8 py-3 border-b bg-white/80 backdrop-blur-md sticky top-0 z-30">
                    <TopBar />
                </div>
                {/* Main Content */}
                <main className="flex-1 overflow-y-auto bg-background p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
