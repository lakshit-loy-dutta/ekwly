import { useEffect, useRef } from 'react';
import { utils } from '../../lib/utils';

interface Props {
  value: number | string;
  prefix?: string;
  durationMs?: number;
  className?: string;
}

function toNumeric(val: number | string): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * High-refresh-rate (60Hz-240Hz) rolling currency counter.
 * Updates DOM textContent directly inside requestAnimationFrame so zero React re-renders occur during animation.
 */
export default function AnimatedNumber({
  value,
  prefix = '',
  durationMs = 360,
  className = '',
}: Props) {
  const numericValue = toNumeric(value);
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const currentValRef = useRef<number>(numericValue);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = currentValRef.current;
    const endVal = numericValue;

    if (Math.abs(endVal - startVal) < 0.005) {
      currentValRef.current = endVal;
      if (spanRef.current) {
        spanRef.current.textContent = `${prefix}${utils.formatMoney(endVal)}`;
      }
      return;
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const interpolated = startVal + (endVal - startVal) * eased;

      currentValRef.current = interpolated;
      if (spanRef.current) {
        spanRef.current.textContent = `${prefix}${utils.formatMoney(interpolated)}`;
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        currentValRef.current = endVal;
        if (spanRef.current) {
          spanRef.current.textContent = `${prefix}${utils.formatMoney(endVal)}`;
        }
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [numericValue, prefix, durationMs]);

  return (
    <span ref={spanRef} className={`tabular-nums ${className}`}>
      {prefix}
      {utils.formatMoney(numericValue)}
    </span>
  );
}
