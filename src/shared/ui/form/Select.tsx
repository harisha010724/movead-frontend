import type { ReactNode } from 'react';
import * as RSelect from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Field } from './Field';
import {
  controlClass,
  controlHeight,
  controlInvalidClass,
  describedBy,
  useFieldIds,
} from './controls';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Shared listbox popover. Radix renders it in a portal, so it escapes the
 * `overflow-hidden` on cards and never gets clipped the way a plain absolutely
 * positioned menu would.
 */
function SelectContent({ children }: { children: ReactNode }) {
  return (
    <RSelect.Portal>
      <RSelect.Content
        position="popper"
        sideOffset={4}
        className={cn(
          'popover-anim z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg',
          'shadow-panel border border-slate-200 bg-white',
        )}
      >
        <RSelect.ScrollUpButton className="flex h-6 items-center justify-center text-slate-400">
          <ChevronUp className="size-3.5" />
        </RSelect.ScrollUpButton>

        <RSelect.Viewport className="p-1">{children}</RSelect.Viewport>

        <RSelect.ScrollDownButton className="flex h-6 items-center justify-center text-slate-400">
          <ChevronDown className="size-3.5" />
        </RSelect.ScrollDownButton>
      </RSelect.Content>
    </RSelect.Portal>
  );
}

export function SelectItem({ value, label, disabled }: SelectOption) {
  return (
    <RSelect.Item
      value={value}
      disabled={disabled ?? false}
      className={cn(
        'relative flex cursor-pointer items-center rounded-md py-1.5 pr-2 pl-7 text-[13px] text-slate-700 select-none',
        'data-[highlighted]:bg-brand-50 data-[highlighted]:text-brand-700 data-[highlighted]:outline-none',
        'data-[state=checked]:font-medium data-[state=checked]:text-slate-900',
        'data-[disabled]:pointer-events-none data-[disabled]:text-slate-300',
      )}
    >
      <span className="absolute left-2 inline-flex w-3.5 items-center justify-center">
        <RSelect.ItemIndicator>
          <Check className="text-brand-600 size-3.5" />
        </RSelect.ItemIndicator>
      </span>
      <RSelect.ItemText>{label}</RSelect.ItemText>
    </RSelect.Item>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  onBlur?: () => void;
  containerClassName?: string;
}

/** Labelled select for forms, with the message rendered below the trigger. */
export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  hint,
  error,
  required,
  disabled,
  name,
  onBlur,
  containerClassName,
}: SelectFieldProps) {
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
      <RSelect.Root
        value={value || undefined}
        onValueChange={onValueChange}
        disabled={disabled ?? false}
        {...(name !== undefined ? { name } : {})}
      >
        <RSelect.Trigger
          id={id}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy({
            hintId,
            errorId,
            hasHint: Boolean(hint),
            hasError: Boolean(error),
          })}
          className={cn(
            controlClass,
            controlHeight,
            'flex items-center justify-between gap-2 text-left',
            'data-[placeholder]:text-slate-400',
            error && controlInvalidClass,
          )}
        >
          <RSelect.Value placeholder={placeholder} />
          <RSelect.Icon>
            <ChevronDown className="size-4 shrink-0 text-slate-400" />
          </RSelect.Icon>
        </RSelect.Trigger>

        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} {...option} />
          ))}
        </SelectContent>
      </RSelect.Root>
    </Field>
  );
}

interface InlineSelectProps {
  /** Accessible name — the design shows no visible label in card headers. */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  /** Borderless variant used inside card headers. */
  subtle?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
}

/** Compact select for card headers and the top bar. */
export function InlineSelect({
  label,
  value,
  onValueChange,
  options,
  subtle = false,
  leadingIcon,
  className,
}: InlineSelectProps) {
  return (
    <RSelect.Root value={value || undefined} onValueChange={onValueChange}>
      <RSelect.Trigger
        aria-label={label}
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-slate-700 transition-colors',
          'focus:ring-brand-500/25 focus:border-brand-500 focus:ring-2 focus:outline-none',
          subtle
            ? 'border border-transparent bg-slate-50 hover:bg-slate-100'
            : 'border border-slate-200 bg-white hover:border-slate-300',
          className,
        )}
      >
        {leadingIcon}
        <RSelect.Value />
        <RSelect.Icon className="ml-auto">
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        </RSelect.Icon>
      </RSelect.Trigger>

      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} {...option} />
        ))}
      </SelectContent>
    </RSelect.Root>
  );
}
