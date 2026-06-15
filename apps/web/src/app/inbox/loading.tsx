import { HeaderSkeleton, Skeleton } from '@/components/ui';

export default function Loading() {
    return (
        <div className="animate-in fade-in duration-300">
            <HeaderSkeleton actions={0} />
            <div className="bg-white rounded-card border border-line shadow-soft grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-200px)] overflow-hidden">
                {/* Conversation list */}
                <div className="border-r border-line p-3 space-y-2">
                    <Skeleton className="h-9 w-full mb-2" />
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-2">
                            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-3.5 w-28 rounded-chip" />
                                <Skeleton className="h-3 w-40 rounded-chip" />
                            </div>
                        </div>
                    ))}
                </div>
                {/* Thread */}
                <div className="hidden md:flex flex-col p-5 gap-4">
                    <Skeleton className="h-12 w-56 rounded-card" />
                    <Skeleton className="h-12 w-72 rounded-card self-end" />
                    <Skeleton className="h-12 w-64 rounded-card" />
                    <Skeleton className="h-12 w-48 rounded-card self-end" />
                </div>
            </div>
        </div>
    );
}
