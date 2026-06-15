'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AppHeader } from './AppHeader';
import { AccountHealthBanner } from './AccountHealthBanner';

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the mobile drawer whenever the route changes (a nav link was tapped).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileNavOpen]);

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="h-screen flex bg-surface overflow-hidden">
      {/* Left sidebar — persistent on lg+ */}
      <div className="hidden lg:flex flex-shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Mobile drawer + backdrop */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[82%] max-w-xs bg-white shadow-2xl animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 z-10 w-8 h-8 grid place-items-center rounded-control text-ink-500 hover:bg-surface"
            >
              <X className="w-5 h-5" />
            </button>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        <AppHeader onMenuClick={() => setMobileNavOpen(true)} />
        <AccountHealthBanner />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 2xl:px-12 py-5 sm:py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
