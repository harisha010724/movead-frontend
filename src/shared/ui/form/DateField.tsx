import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/format';
import { isoYearMonth, monthGrid, platformTodayIso } from '@/shared/lib/civilDate';
import { Field } from './Field';
import {
  controlClass,
  controlHeight,
  controlInvalidClass,
  describedBy,
  useFieldIds,
} from './controls';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const monthTitle = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min?: string;
  max?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  containerClassName?: string;
}

/**
 * Civil-date picker that matches the shared control surface.
 *
 * Native `type="date"` uses the browser's calendar, which does not follow the
 * rest of the form. This one does: same height and ring, same popover chrome
 * as Select, and `min`/`max` so an end date cannot be chosen on or before the
 * start date.
 */
export function DateField({
  label,
  value,
  onChange,
  onBlur,
  min,
  max,
  hint,
  error,
  required,
  disabled,
  placeholder = 'Select a date',
  name,
  containerClassName,
}: DateFieldProps) {
  const { id, hintId, errorId } = useFieldIds();
  const headingId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => isoYearMonth(value || min || platformTodayIso()));

  useEffect(() => {
    if (open) setCursor(isoYearMonth(value || min || platformTodayIso()));
  }, [open, value, min]);

  useEffect(() => {
    if (!open) return;

    const dismiss = () => {
      setOpen(false);
      onBlur?.();
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      dismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function close(): void {
    setOpen(false);
    onBlur?.();
  }

  function select(iso: string): void {
    if (outOfRange(iso, min, max)) return;
    onChange(iso);
    close();
  }

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      id={id}
      name={name}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy({
        hintId,
        errorId,
        hasHint: Boolean(hint),
        hasError: Boolean(error),
      })}
      onClick={() => {
        if (disabled) return;
        setOpen((was) => !was);
      }}
      className={cn(
        controlClass,
        controlHeight,
        'flex items-center justify-between gap-2 text-left',
        !value && 'text-slate-400',
        error && controlInvalidClass,
      )}
    >
      <span className="truncate">{value ? formatDate(`${value}T00:00:00Z`) : placeholder}</span>
      <CalendarDays className="size-4 shrink-0 text-slate-400" aria-hidden />
    </button>
  );

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
      {trigger}
      {open
        ? createPortal(
            <CalendarPopover
              ref={rootRef}
              trigger={triggerRef.current}
              headingId={headingId}
              cursor={cursor}
              value={value}
              min={min}
              max={max}
              onCursor={setCursor}
              onSelect={select}
            />,
            document.body,
          )
        : null}
    </Field>
  );
}

function CalendarPopover({
  ref,
  trigger,
  headingId,
  cursor,
  value,
  min,
  max,
  onCursor,
  onSelect,
}: {
  ref: Ref<HTMLDivElement>;
  trigger: HTMLButtonElement | null;
  headingId: string;
  cursor: { year: number; month: number };
  value: string;
  min?: string;
  max?: string;
  onCursor: (next: { year: number; month: number }) => void;
  onSelect: (iso: string) => void;
}) {
  const rect = trigger?.getBoundingClientRect();
  const today = platformTodayIso();
  const cells = monthGrid(cursor.year, cursor.month);
  const titleDate = new Date(Date.UTC(cursor.year, cursor.month, 1));
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
  const openUp = Boolean(rect && spaceBelow < 360 && rect.top > spaceBelow);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      data-state="open"
      className="popover-anim z-50 w-[288px] rounded-xl border border-slate-200 bg-white p-3 shadow-panel"
      style={
        rect
          ? {
              position: 'fixed',
              top: openUp ? undefined : rect.bottom + 4,
              bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
              left: Math.min(rect.left, window.innerWidth - 304),
            }
          : { position: 'fixed', top: 80, left: 24 }
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <IconButton
          label="Previous month"
          onClick={() => onCursor(shiftMonth(cursor, -1))}
        >
          <ChevronLeft className="size-4" />
        </IconButton>
        <p id={headingId} className="text-[13px] font-semibold text-slate-900">
          {monthTitle.format(titleDate)}
        </p>
        <IconButton label="Next month" onClick={() => onCursor(shiftMonth(cursor, 1))}>
          <ChevronRight className="size-4" />
        </IconButton>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            className="py-1 text-center text-[10px] font-medium tracking-wide text-slate-400 uppercase"
          >
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((iso) => {
          const inMonth = isoYearMonth(iso).month === cursor.month;
          const selected = iso === value;
          const isToday = iso === today;
          const blocked = outOfRange(iso, min, max);

          return (
            <button
              key={iso}
              type="button"
              disabled={blocked}
              onClick={() => onSelect(iso)}
              className={cn(
                'grid h-8 place-items-center rounded-lg text-[12px] tabular-nums transition-colors',
                'focus-visible:ring-brand-500/40 focus-visible:ring-2 focus-visible:outline-none',
                !inMonth && !selected && 'text-slate-300',
                inMonth && !selected && !blocked && 'text-slate-700 hover:bg-brand-50',
                isToday && !selected && 'ring-brand-200 font-medium ring-1 ring-inset',
                selected && 'bg-brand-500 font-semibold text-white hover:bg-brand-600',
                blocked && 'cursor-not-allowed text-slate-300 hover:bg-transparent',
              )}
            >
              {Number(iso.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

function shiftMonth(cursor: { year: number; month: number }, delta: number) {
  const next = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
}

function outOfRange(iso: string, min?: string, max?: string): boolean {
  return Boolean((min && iso < min) || (max && iso > max));
}

