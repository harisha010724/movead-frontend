import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/shared/api/client';
import { toDisplayMessage } from '@/shared/api/errors';
import { VALIDATION_MODE } from '@/shared/lib/formConfig';
import { Button, Dialog } from '@/shared/ui';
import { FormError, TextareaField } from '@/shared/ui/form';

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Give a reason of at least 10 characters — it is the only record of why')
    .max(500, 'Keep the reason under 500 characters'),
});

type Values = z.infer<typeof schema>;

/**
 * A destructive decision that has to be explained.
 *
 * The same shape recurs across rejections — driver, vehicle, campaign — and
 * the 10-character floor matches the API's, so a reason the server would
 * refuse never gets as far as being sent.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  hint,
  placeholder,
  confirmLabel,
  path,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  hint: string;
  placeholder: string;
  confirmLabel: string;
  /** The endpoint that takes `{ reason }`. */
  path: string;
  onDone: () => Promise<void> | void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    ...VALIDATION_MODE,
    defaultValues: { reason: '' },
  });

  useEffect(() => {
    if (open) form.reset({ reason: '' });
  }, [open, form]);

  const submit = useMutation({
    mutationFn: (values: Values) => api.post(path, { reason: values.reason }),
    onSuccess: async () => {
      await onDone();
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && submit.isPending) return;
        onOpenChange(next);
      }}
      title={title}
      {...(description ? { description } : {})}
      dismissible={!submit.isPending}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submit.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="reason-dialog" variant="danger" loading={submit.isPending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id="reason-dialog"
        noValidate
        onSubmit={(event) => void form.handleSubmit((values) => submit.mutate(values))(event)}
      >
        <TextareaField
          label="Reason"
          required
          autoFocus
          rows={3}
          placeholder={placeholder}
          hint={hint}
          error={form.formState.errors.reason?.message}
          {...form.register('reason')}
        />
        {submit.isError ? <FormError message={toDisplayMessage(submit.error)} /> : null}
      </form>
    </Dialog>
  );
}
