import { motion } from 'framer-motion';

export type LoaderState = 'lockin' | 'equalizer' | 'scan' | 'loading' | 'scanning' | 'success';
export type BrandSurface = 'auto' | 'dark' | 'light' | 'mono-white' | 'mono-black';

/**
 * Locked v3 Master Geometry Constants (100x100 Coordinate Grid):
 * T = 13.90 | H = 85.50 | W = 76.50 | g = 4.00 | s = 8.50
 * Outer R = 12.00 | Inner Fillet = 7.00 | Tip R = 6.00
 * Mid Arm = 66% (xMidRight = 68.15) | '=' Ext = -10 (xEqStart = 37.63, eqWidth = 40.63)
 */
export const EKWLY_E_PATH =
  'M 23.75 7.25 L 82.25 7.25 A 6.00 6.00 0 0 1 88.25 13.25 L 88.25 15.15 A 6.00 6.00 0 0 1 82.25 21.15 L 36.13 21.15 A 7.00 7.00 0 0 0 29.13 28.15 L 29.13 36.05 A 7.00 7.00 0 0 0 36.13 43.05 L 62.15 43.05 A 6.00 6.00 0 0 1 68.15 49.05 L 68.15 50.95 A 6.00 6.00 0 0 1 62.15 56.95 L 36.13 56.95 A 7.00 7.00 0 0 0 29.13 63.95 L 29.13 71.85 A 7.00 7.00 0 0 0 36.13 78.85 L 82.25 78.85 A 6.00 6.00 0 0 1 88.25 84.85 L 88.25 86.75 A 6.00 6.00 0 0 1 82.25 92.75 L 23.75 92.75 A 12.00 12.00 0 0 1 11.75 80.75 L 11.75 19.25 A 12.00 12.00 0 0 1 23.75 7.25 Z';

function resolveColors(surface: BrandSurface, boxed: boolean) {
  if (surface === 'mono-white') {
    return { eFill: '#FFFFFF', kwlyStroke: '#FFFFFF', eqTop: '#FFFFFF', eqBot: '#FFFFFF' };
  }
  if (surface === 'mono-black') {
    return { eFill: '#050914', kwlyStroke: '#050914', eqTop: '#050914', eqBot: '#050914' };
  }
  if (surface === 'light') {
    return { eFill: '#050914', kwlyStroke: '#0284C7', eqTop: '#0080FF', eqBot: '#38BDF8' };
  }
  if (surface === 'dark' || boxed) {
    return { eFill: '#FFFFFF', kwlyStroke: '#93C5FD', eqTop: '#0080FF', eqBot: '#38BDF8' };
  }
  return {
    eFill: 'var(--text-main)',
    kwlyStroke: 'var(--brand-kwly, #93C5FD)',
    eqTop: '#0080FF',
    eqBot: '#38BDF8',
  };
}

interface LogoProps {
  size?: number;
  boxed?: boolean;
  surface?: BrandSurface;
  className?: string;
}

/**
 * Standalone Icon Mark (<BrandLogo />) — App Icon, Favicon & Auth Hero Badge
 */
export function BrandLogo({
  size = 32,
  boxed = true,
  surface = 'auto',
  className = '',
}: LogoProps) {
  const colors = resolveColors(surface, boxed);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none \${className}`}
      aria-label="Ekwly Logo"
    >
      {boxed && (
        <>
          <defs>
            <linearGradient
              id="ekwly-v3-bg"
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#071226" />
              <stop offset="100%" stopColor="#0F2342" />
            </linearGradient>
          </defs>
          <rect
            x="2"
            y="2"
            width="96"
            height="96"
            rx="24"
            fill="url(#ekwly-v3-bg)"
            stroke="#1E3A5F"
            strokeWidth="2"
          />
        </>
      )}
      <path d={EKWLY_E_PATH} fill={colors.eFill} />
      <rect x="37.63" y="25.15" width="40.63" height="13.90" rx="6.00" fill={colors.eqTop} />
      <rect x="37.63" y="60.95" width="40.63" height="13.90" rx="6.00" fill={colors.eqBot} />
    </svg>
  );
}

interface WordmarkProps {
  height?: number;
  surface?: BrandSurface;
  className?: string;
}

/**
 * Unified Single-SVG Wordmark (<BrandWordmark />) — "[E=]kwly"
 * Uses viewBox="0 0 354 114" so the descender of 'y' (reaching Y=109.8) is never clipped.
 */
export function BrandWordmark({ height = 32, surface = 'auto', className = '' }: WordmarkProps) {
  const colors = resolveColors(surface, false);
  const widthPx = Math.round(height * (354 / 114));

  return (
    <svg
      width={widthPx}
      height={height}
      viewBox="0 0 354 114"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none \${className}`}
      aria-label="Ekwly"
    >
      {/* Capital E= Monolith & Negative-Space '=' Bars */}
      <path d={EKWLY_E_PATH} fill={colors.eFill} />
      <rect x="37.63" y="25.15" width="40.63" height="13.90" rx="6.00" fill={colors.eqTop} />
      <rect x="37.63" y="60.95" width="40.63" height="13.90" rx="6.00" fill={colors.eqBot} />

      {/* Custom Rounded Vector 'kwly' (Gap: 3 -> X: 91.25, Scale: 1.09, Y: -8 -> 4.09, Stroke: 15) */}
      <g
        transform="translate(91.25, 4.09) scale(1.09)"
        stroke={colors.kwlyStroke}
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* k */}
        <path d="M 14 12 L 14 74" />
        <path d="M 46 34 L 18 53 L 48 74" />
        {/* w */}
        <path d="M 70 34 L 83 74 L 99 44 L 115 74 L 128 34" />
        {/* l */}
        <path d="M 152 12 L 152 65 Q 152 74 162 74" />
        {/* y */}
        <path d="M 182 34 L 200 68" />
        <path d="M 220 34 L 195 83 Q 190 91 179 89" />
      </g>
    </svg>
  );
}

interface LoaderProps {
  label?: string;
  state?: LoaderState;
  fullScreen?: boolean;
}

/**
 * Multi-Mode Animated Icon Loader (<BrandLoader />)
 * Supports all 3 Studio v3 animations:
 * - 'lockin' (or 'loading'): 1.0s Magnetic Lock-In with squash-and-stretch overshoot
 * - 'equalizer': 1.0s Counter-Phase Equalizer balance
 * - 'scan' (or 'scanning'): 1.2s AI Laser Scan sweep
 * - 'success': Bouncy emerald lock confirmation
 */
export default function BrandLoader({
  label = 'Syncing...',
  state = 'lockin',
  fullScreen = false,
}: LoaderProps) {
  const normalizedMode = state === 'loading' ? 'lockin' : state === 'scanning' ? 'scan' : state;

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 select-none \${
        fullScreen ? 'min-h-[70vh] w-full' : 'py-12 w-full flex-1'
      }`}
    >
      <div className="relative w-16 h-16 rounded-2xl bg-surface border border-border shadow-lg flex items-center justify-center overflow-hidden gpu-layer">
        <div className="absolute inset-0 bg-primary/8" />

        <svg
          width="48"
          height="48"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10"
        >
          {/* Positive 'E' Monolith */}
          <path d={EKWLY_E_PATH} fill="var(--text-main)" />

          {/* Upper '=' Bar */}
          <motion.rect
            x="37.63"
            y="25.15"
            width="40.63"
            height="13.90"
            rx="6.00"
            fill="#0080FF"
            style={{ transformBox: 'fill-box', originX: 0, originY: 0.5 }}
            animate={
              normalizedMode === 'success'
                ? { x: 0, scaleX: 1, opacity: 1, fill: '#10B981' }
                : normalizedMode === 'equalizer'
                  ? {
                      x: [0, 5, -1.5, 0],
                      scaleX: [1, 0.72, 1.08, 1],
                      opacity: 1,
                    }
                  : normalizedMode === 'scan'
                    ? { x: 0, scaleX: 1, opacity: 1 }
                    : {
                        // 'lockin' (Studio v3 exact keyframes)
                        x: [26, -2.5, 1.5, 0, 0],
                        scaleX: [0.5, 1.06, 0.97, 1, 1],
                        opacity: [0, 1, 1, 1, 1],
                      }
            }
            transition={
              normalizedMode === 'success'
                ? { type: 'spring', stiffness: 600, damping: 22 }
                : normalizedMode === 'equalizer'
                  ? {
                      duration: 1.0,
                      times: [0, 0.45, 0.8, 1],
                      repeat: Infinity,
                      ease: [0.45, 0, 0.55, 1],
                    }
                  : normalizedMode === 'scan'
                    ? { duration: 0.2 }
                    : {
                        duration: 1.0,
                        times: [0, 0.45, 0.65, 0.8, 1],
                        repeat: Infinity,
                        ease: [0.22, 1, 0.36, 1],
                      }
            }
          />

          {/* Lower '=' Bar */}
          <motion.rect
            x="37.63"
            y="60.95"
            width="40.63"
            height="13.90"
            rx="6.00"
            fill="#38BDF8"
            style={{ transformBox: 'fill-box', originX: 0, originY: 0.5 }}
            animate={
              normalizedMode === 'success'
                ? { x: 0, scaleX: 1, opacity: 1, fill: '#10B981' }
                : normalizedMode === 'equalizer'
                  ? {
                      x: [0, -2, 6, 0],
                      scaleX: [1, 1.1, 0.7, 1],
                      opacity: 1,
                    }
                  : normalizedMode === 'scan'
                    ? { x: 0, scaleX: 1, opacity: 1 }
                    : {
                        // 'lockin' (Studio v3 exact staggered keyframes)
                        x: [26, 26, -2.5, 1.5, 0, 0],
                        scaleX: [0.5, 0.5, 1.06, 0.97, 1, 1],
                        opacity: [0, 0, 1, 1, 1, 1],
                      }
            }
            transition={
              normalizedMode === 'success'
                ? { type: 'spring', stiffness: 600, damping: 22, delay: 0.05 }
                : normalizedMode === 'equalizer'
                  ? {
                      duration: 1.0,
                      times: [0, 0.45, 0.8, 1],
                      repeat: Infinity,
                      ease: [0.45, 0, 0.55, 1],
                    }
                  : normalizedMode === 'scan'
                    ? { duration: 0.2 }
                    : {
                        duration: 1.0,
                        times: [0, 0.12, 0.55, 0.75, 0.9, 1],
                        repeat: Infinity,
                        ease: [0.22, 1, 0.36, 1],
                      }
            }
          />

          {/* AI Laser Sweep when normalizedMode === 'scan' */}
          {normalizedMode === 'scan' && (
            <motion.rect
              x="8"
              y="0"
              width="84"
              height="3.5"
              rx="1.75"
              fill="#38BDF8"
              animate={{ y: [12, 86, 12], opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </svg>
      </div>

      {label && (
        <span className="text-xs font-bold uppercase tracking-widest text-muted animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}
