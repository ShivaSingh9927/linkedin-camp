import { HeaderSkeleton, TableSkeleton } from '@/components/ui';

export default function Loading() {
    return (
        <div className="animate-in fade-in duration-300">
            <HeaderSkeleton actions={1} />
            <TableSkeleton rows={8} cols={5} />
        </div>
    );
}
