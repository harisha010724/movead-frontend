import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Field } from './Field';
import {
  controlClass,
  controlHeight,
  controlInvalidClass,
  describedBy,
  useFieldIds,
} from './controls';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
}

/**
 * Forwards its ref so react-hook-form can register the input and focus it when
 * validation fails.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, containerClassName, required, ...props },
  ref,
) {
  const { id, hintId, errorId } = useFieldIds();

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
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({
          hintId,
          errorId,
          hasHint: Boolean(hint),
          hasError: Boolean(error),
        })}
        className={cn(controlClass, controlHeight, error && controlInvalidClass, className)}
        {...props}
      />
    </Field>
  );
});
