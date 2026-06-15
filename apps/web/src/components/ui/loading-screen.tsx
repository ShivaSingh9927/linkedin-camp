import { cn } from '@/lib/utils';

/**
 * LoadingScreen — the branded full-area loader shown while auth validates or a
 * route's data is loading. Replaces bare spinners with the Qampi mark + a soft
 * brand pulse so loads feel intentional, not broken.
 *
 * `fullScreen` covers the viewport (auth gate / first paint); without it the
 * loader fills its parent container (in-page section loads).
 */
export function LoadingScreen({
    label = 'Loading…',
    fullScreen = false,
    className,
}: {
    label?: string;
    fullScreen?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'w-full grid place-items-center bg-surface',
                fullScreen ? 'h-screen' : 'h-full min-h-[60vh]',
                className
            )}
        >
            <div className="flex flex-col items-center gap-5">
                <div className="relative grid place-items-center">
                    {/* Pulsing brand halo behind the mark */}
                    <span className="absolute w-20 h-20 rounded-full bg-brand/10 animate-ping" />
                    <span className="absolute w-16 h-16 rounded-full bg-brand/15" />
                    <div className="relative w-14 h-14 rounded-panel bg-white shadow-lift grid place-items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/qampi_wbg.png" alt="Qampi" className="w-9 h-9 object-contain" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                    {label}
                </div>
            </div>
        </div>
    );
}
