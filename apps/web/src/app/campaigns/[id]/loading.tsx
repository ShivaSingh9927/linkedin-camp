import { HeaderSkeleton, StatRowSkeleton, Skeleton } from '@/components/ui';

export default function Loading() {
    return (
        <div className="animate-in fade-in duration-300 space-y-6">
            <HeaderSkeleton actions={2} />
            <StatRowSkeleton count={5} />
            <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-24" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-64 w-full rounded-card" />
                <Skeleton className="h-64 w-full rounded-card" />
            </div>
        </div>
    );
}
