'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { AccountHealthBanner } from './AccountHealthBanner';

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="h-screen flex bg-surface overflow-hidden">
      {/* Left sidebar — hidden on small screens (mobile nav is a follow-up) */}
      <div className="hidden lg:flex flex-shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        <AppHeader />
        <AccountHealthBanner />
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 lg:px-8 2xl:px-12 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
