import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface HandDrawnButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

export const HandDrawnButton = forwardRef<HTMLButtonElement, HandDrawnButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles = 
      'border-wobbly border-[3px] border-foreground font-body transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantStyles = {
      primary: 'bg-card text-foreground shadow-hand hover:bg-accent hover:text-white hover:shadow-hand-sm hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]',
      secondary: 'bg-muted text-foreground shadow-hand hover:bg-secondary-accent hover:text-white hover:shadow-hand-sm hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]',
      accent: 'bg-accent text-white shadow-hand hover:bg-accent/90 hover:shadow-hand-sm hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]',
    };
    
    const sizeStyles = {
      sm: 'px-4 py-2 text-base',
      md: 'px-6 py-3 text-lg',
      lg: 'px-8 py-4 text-xl',
    };
    
    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

HandDrawnButton.displayName = 'HandDrawnButton';
