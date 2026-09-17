import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Field } from './Field';
import {
  controlClass,
  controlHeight,
  controlInvalidClass,
  describedBy,
  useFieldIds,
} from './controls';

export interface PasswordFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
}

/**
 * A password input with a reveal toggle, matching the driver app's login field.
 *
 * Accounts are created by operations and the password arrives by email, so it
 * is nearly always pasted or retyped from somewhere else rather than recalled.
 * Without a way to check what landed in the box, a mistyped character is
 * indistinguishable from a wrong password, and the only feedback is the
 * server's "Email or password is incorrect".
 *
 * `type` is omitted from the props deliberately: the toggle owns it.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { label, hint, error, className, containerClassName, required, disabled, ...props },
    ref,
  ) {
    const { id, hintId, errorId } = useFieldIds();
    const [revealed, setRevealed] = useState(false);

    const Icon = revealed ? EyeOff : Eye;

    return (
      <Field
        label={label}
        htmlFor={id}
        hintId={hintId}
        errorId={errorId}
        {...(hint !== undefined ? { hint } : {})}
        {...(error !== undefined ? { error } : {})}
        {...(required !== undefined ? { required } : {})}
        {...(containerClassName !== undefined ? { className: containerClassName } : {})}
      >
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={revealed ? 'text' : 'password'}
            required={required}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy({
              hintId,
              errorId,
              hasHint: Boolean(hint),
              hasError: Boolean(error),
            })}
            /* Room for the button, which overlaps the input's own padding. */
            className={cn(
              controlClass,
              controlHeight,
              'pr-11',
              error && controlInvalidClass,
              className,
            )}
            {...props}
          />

          <button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            disabled={disabled}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            aria-controls={id}
            className={cn(
              'absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-slate-400',
              'transition-colors hover:text-slate-600',
              'focus-visible:ring-2 focus-visible:ring-brand-500/25 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:text-slate-300',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        </div>
      </Field>
    );
  },
);
