import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-500/40',
  secondary:
    'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-600/40',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
  /**
   * Renders the child element with the button's styling instead of a `button`.
   * Use for navigation, so a link stays a link: `<Button asChild><Link …>`.
   * A `button` with an onClick that navigates cannot be opened in a new tab and
   * has no URL on hover.
   */
  asChild?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leadingIcon,
  asChild = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
    'focus-visible:ring-brand-500/40 focus-visible:ring-2 focus-visible:outline-none',
    'disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    className,
  );

  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      type={type}
      // Prevents the double-submit that turns one payout release into two.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : leadingIcon}
      {children}
    </button>
  );
}
