import { Skeleton } from './skeleton';

/** Page title + subtitle block, mirrors PageHeader. */
export function HeaderSkeleton({ actions = 1 }: { actions?: number }) {
    return (
        <div className="flex items-end justify-between mb-7">
            <div className="space-y-2.5">
                <Skeleton className="h-7 w-48 rounded-chip" />
                <Skeleton className="h-4 w-72 rounded-chip" />
            </div>
            <div className="flex gap-2">
                {Array.from({ length: actions }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-32" />
                ))}
            </div>
        </div>
    );
}

/** White card wrapping a rows-style table skeleton. */
export function TableSkeleton({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="bg-white rounded-card border border-line shadow-soft overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-3 border-b border-line">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className={`h-3 rounded-chip ${i === 0 ? 'w-40' : 'w-24'}`} />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex items-center gap-4 px-4 py-3.5 border-b border-line last:border-0">
                    <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-40 rounded-chip" />
                    <Skeleton className="h-4 w-28 rounded-chip ml-auto" />
                    <Skeleton className="h-4 w-20 rounded-chip" />
                    <Skeleton className="h-4 w-16 rounded-chip" />
                </div>
            ))}
        </div>
    );
}

/** Row of KPI stat tiles. */
export function StatRowSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white rounded-card border border-line shadow-soft p-5 space-y-3">
                    <Skeleton className="w-9 h-9 rounded-control" />
                    <Skeleton className="h-6 w-16 rounded-chip" />
                    <Skeleton className="h-3 w-20 rounded-chip" />
                </div>
            ))}
        </div>
    );
}
