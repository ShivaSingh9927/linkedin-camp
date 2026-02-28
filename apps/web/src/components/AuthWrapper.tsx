"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);

    const authRoutes = ['/login', '/register'];

    useEffect(() => {
        const token = localStorage.getItem('token');

        if (!token && !authRoutes.includes(pathname)) {
            router.push('/login');
        } else if (token && authRoutes.includes(pathname)) {
            router.push('/');
        } else {
            setLoading(false);
        }
    }, [pathname, router]);

    if (loading && !authRoutes.includes(pathname)) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
}
