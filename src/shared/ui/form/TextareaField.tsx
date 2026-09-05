import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';
import { Field } from './Field';
import { controlClass, controlInvalidClass, describedBy, useFieldIds } from './controls';

export interface TextareaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
}

/**
 * A multi-line input, for the places the API asks for a reason.
 *
 * Those reasons are read by a driver, not parsed by a machine, so the control
 * has to look like somewhere a sentence goes. A single-line input invites four
 * words and the API rejects anything under ten characters.
 */
export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField(
    { label, hint, error, className, containerClassName, required, rows = 3, ...props },
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
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy({
            hintId,
            errorId,
            hasHint: Boolean(hint),
            hasError: Boolean(error),
          })}
          className={cn(controlClass, 'py-2 leading-relaxed', error && controlInvalidClass, className)}
          {...props}
        />
      </Field>
    );
  },
);
