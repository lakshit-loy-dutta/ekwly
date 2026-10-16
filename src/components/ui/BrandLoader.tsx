import { motion } from 'framer-motion';

interface LogoProps {
  size?: number;
  className?: string;
}

export function BrandLogo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        <linearGradient
          id="ekwly-bg-grad"
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0080FF" />
          <stop offset="100%" stopColor="#004589" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#ekwly-bg-grad)" />
      {/* Top Split Bar */}
      <rect x="14" y="16" width="36" height="7" rx="3.5" fill="#FFFFFF" />
      {/* Middle Equilibrium Bar (Accent) */}
      <rect x="14" y="28.5" width="24" height="7" rx="3.5" fill="#7CC4FF" />
      <circle cx="46.5" cy="32" r="3.5" fill="#10B981" />
      {/* Bottom Split Bar */}
      <rect x="14" y="41" width="36" height="7" rx="3.5" fill="#FFFFFF" />
    </svg>
  );
}

interface LoaderProps {
  label?: string;
  fullScreen?: boolean;
}

export default function BrandLoader({ label = 'Syncing...', fullScreen = false }: LoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 select-none ${
        fullScreen ? 'min-h-[70vh] w-full' : 'py-12 w-full flex-1'
      }`}
    >
      <div className="relative w-16 h-16 rounded-2xl bg-surface border border-border shadow-lg flex items-center justify-center overflow-hidden gpu-layer">
        <div className="absolute inset-0 bg-primary/10" />
        <svg
          width="44"
          height="44"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10"
        >
          {/* Top Bar */}
          <motion.rect
            x="12"
            y="15"
            width="40"
            height="8"
            rx="4"
            fill="var(--color-primary)"
            animate={{ x: [0, 6, -4, 0], scaleX: [1, 0.85, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Middle Bar */}
          <motion.rect
            x="12"
            y="28"
            width="28"
            height="8"
            rx="4"
            fill="#10B981"
            animate={{ x: [0, -6, 8, 0], scaleX: [1, 1.15, 0.9, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.12 }}
          />
          {/* Bottom Bar */}
          <motion.rect
            x="12"
            y="41"
            width="40"
            height="8"
            rx="4"
            fill="var(--color-primary)"
            animate={{ x: [0, 4, -6, 0], scaleX: [1, 0.9, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.24 }}
          />
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
