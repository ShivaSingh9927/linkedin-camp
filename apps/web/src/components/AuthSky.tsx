'use client';

// Ambient auth background: a soft dawn-lavender sky (derived from the brand
// purple) with three parallax layers of side-profile pigeons that flap and
// drift across. Pure inline SVG — no image asset, crisp at any size. The sky
// stays light so the white auth card and dark text stay legible on top.

type Bird = {
    y: number;
    scale: number;
    rot: number;
    delay: number;   // negative → already mid-flight on load (spreads the flock)
    wingDur: number;
    wingDelay: number;
};

// Per-layer flight duration (parallax: far drifts slow, near drifts fast).
const LAYERS: { opacity: number; dur: number; filter?: string; birds: Bird[] }[] = [
    {
        opacity: 0.22, dur: 26, filter: 'url(#asky-haze)', birds: [
            { y: 120, scale: 0.55, rot: 3, delay: 0, wingDur: 0.58, wingDelay: 0 },
            { y: 95, scale: 0.48, rot: -2, delay: -13, wingDur: 0.62, wingDelay: 0.3 },
        ],
    },
    {
        opacity: 0.4, dur: 18, birds: [
            { y: 300, scale: 0.9, rot: 4, delay: -3, wingDur: 0.6, wingDelay: 0.15 },
            { y: 340, scale: 1, rot: -3, delay: -11, wingDur: 0.64, wingDelay: 0 },
        ],
    },
    {
        opacity: 0.55, dur: 12, filter: 'url(#asky-motion)', birds: [
            { y: 540, scale: 1.6, rot: -4, delay: -2, wingDur: 0.72, wingDelay: 0.2 },
        ],
    },
];

export function AuthSky() {
    return (
        <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1200 700"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
        >
            <defs>
                {/* vertical brand wash: brand-200 → brand-100 → brand-50 → white near the card */}
                <linearGradient id="asky-sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d9ccff" />
                    <stop offset="38%" stopColor="#ece6ff" />
                    <stop offset="70%" stopColor="#f4f1ff" />
                    <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
                {/* diagonal brand tint so the wash isn't flat */}
                <linearGradient id="asky-tint" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.22" />
                    <stop offset="55%" stopColor="#d9ccff" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                {/* soft brand glow upper-right */}
                <radialGradient id="asky-sun" cx="80%" cy="20%" r="45%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="55%" stopColor="#ece6ff" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#ece6ff" stopOpacity="0" />
                </radialGradient>
                {/* pigeon body (facing right): wedge tail, plump belly, short neck, small round head + stub beak */}
                <path id="asky-body" d="M-30,-3
                         L-21,-1
                         C-12,-3 0,-4 8,-5
                         C12,-6 14,-9 17,-9
                         C20,-10 22,-9 23,-7
                         C23,-5 21,-4 19,-4
                         C16,-3 13,-2 10,-1
                         C4,2 -1,6 -6,8
                         C-14,9 -22,8 -27,5
                         L-30,4
                         L-25,1 Z" />
                {/* pigeon wing: pointed, swept back (tip up and toward the tail) */}
                <path id="asky-wing" d="M1,-1
                         C-2,-9 -9,-17 -18,-17
                         C-12,-11 -6,-5 -2,1 Z" />
                {/* soft edge for clouds */}
                <filter id="asky-soft" x="-30%" y="-60%" width="160%" height="220%">
                    <feGaussianBlur stdDeviation="9" />
                </filter>
                {/* atmospheric haze: distant birds lose crispness */}
                <filter id="asky-haze" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="0.9" />
                </filter>
                {/* motion streak: fast near birds blur along the X axis (sense of speed) */}
                <filter id="asky-motion" x="-40%" y="-20%" width="180%" height="140%">
                    <feGaussianBlur stdDeviation="2.2 0.3" />
                </filter>
                {/* a puffy cloud built from overlapping blobs, top-lit (lighter on top) */}
                <linearGradient id="asky-cloudfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#f4f1ff" />
                </linearGradient>
                <g id="asky-cloud" fill="url(#asky-cloudfill)">
                    <ellipse cx="0" cy="14" rx="92" ry="22" />
                    <circle cx="-52" cy="6" r="26" />
                    <circle cx="-20" cy="-12" r="36" />
                    <circle cx="20" cy="-16" r="30" />
                    <circle cx="52" cy="-4" r="28" />
                    <circle cx="78" cy="8" r="20" />
                </g>
            </defs>

            <rect width="1200" height="700" fill="url(#asky-sky)" />
            <rect width="1200" height="700" fill="url(#asky-tint)" />
            <rect width="1200" height="700" fill="url(#asky-sun)" />

            {/* puffy clouds — softened with blur, gently floating */}
            <g filter="url(#asky-soft)">
                <g transform="translate(210,110) scale(1.15)" opacity="0.9">
                    <use href="#asky-cloud" className="asky-cloud-float" style={{ ['--cdur' as string]: '34s', ['--cdx' as string]: '34px' }} />
                </g>
                <g transform="translate(880,90) scale(0.85)" opacity="0.8">
                    <use href="#asky-cloud" className="asky-cloud-float" style={{ ['--cdur' as string]: '42s', ['--cdx' as string]: '-30px', animationDelay: '-8s' }} />
                </g>
                <g transform="translate(560,250) scale(1.5)" opacity="0.7">
                    <use href="#asky-cloud" className="asky-cloud-float" style={{ ['--cdur' as string]: '50s', ['--cdx' as string]: '26px', animationDelay: '-20s' }} />
                </g>
                <g transform="translate(1040,300) scale(1.1)" opacity="0.65">
                    <use href="#asky-cloud" className="asky-cloud-float" style={{ ['--cdur' as string]: '46s', ['--cdx' as string]: '-22px', animationDelay: '-5s' }} />
                </g>
            </g>

            {/* flock — birds face left; outer .asky-drift flies left→right, inner sets position/size/tilt, wing flaps */}
            <g fill="#6f5aa6" stroke="none">
                {LAYERS.map((layer, li) => (
                    <g key={li} opacity={layer.opacity} filter={layer.filter}>
                        {layer.birds.map((b, bi) => (
                            <g
                                key={bi}
                                className="asky-drift"
                                style={{ ['--dur' as string]: `${layer.dur}s`, ['--delay' as string]: `${b.delay}s` }}
                            >
                                <g transform={`translate(0,${b.y}) scale(${b.scale},${b.scale}) rotate(${b.rot})`}>
                                    <use href="#asky-body" />
                                    <use
                                        href="#asky-wing"
                                        className="asky-wing"
                                        style={{ animationDuration: `${b.wingDur}s`, animationDelay: `${b.wingDelay}s` }}
                                    />
                                </g>
                            </g>
                        ))}
                    </g>
                ))}
            </g>
        </svg>
    );
}
