import { HeaderSkeleton, TableSkeleton, Skeleton } from '@/components/ui';

export default function Loading() {
    return (
        <div className="animate-in fade-in duration-300">
            <HeaderSkeleton actions={2} />
            <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-6">
                {/* Lists rail */}
                <aside className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full" />
                    ))}
                </aside>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                    <TableSkeleton rows={8} cols={5} />
                </div>
            </div>
        </div>
    );
}
