import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PromoChipProps {
  children: ReactNode;
  className?: string;
}

/**
 * Small uppercase pill badge used above hero headlines.
 * e.g. "NEW — AI TRIP COMPANION"
 */
export function PromoChip({ children, className }: PromoChipProps) {
  return <span className={cn('chip-promo', className)}>{children}</span>;
}
