'use client';

import { usePathname } from 'next/navigation';
import { TopNav } from './TopNav';

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <TopNav />
      <main className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-10 max-w-[1800px]">
          {children}
        </div>
      </main>
    </div>
  );
}
