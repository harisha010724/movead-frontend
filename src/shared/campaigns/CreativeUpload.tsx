import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import * as RDialog from '@radix-ui/react-dialog';
import { Expand, FileText, ImageIcon, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Badge, Button } from '@/shared/ui';
import { FormError } from '@/shared/ui/form';
import {
  CREATIVE_ACCEPT,
  acceptCreative,
  creativeKind,
  formatFileSize,
  type CreativeKind,
} from './creativeFile';

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return url;
}

export interface ExistingCreative {
  name: string;
  href: string;
  kind: CreativeKind;
}

/**
 * Local preview of wrap artwork. The file stays in the browser until submit;
 * the same object URL is used for PNG `<img>` and PDF `<iframe>` so the
 * advertiser can check the creative before it is stored. On edit, `existing`
 * is the already-uploaded file until a replacement is chosen.
 */
export function CreativeUpload({
  file,
  existing,
  onChange,
}: {
  file: File | null;
  existing?: ExistingCreative | null;
  onChange: (file: File | null) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const objectUrl = useObjectUrl(file);
  const kind = file ? creativeKind(file) : (existing?.kind ?? null);
  const previewUrl = objectUrl ?? (file ? null : (existing?.href ?? null));
  const previewName = file?.name ?? existing?.name ?? 'Creative';
  const sizeLabel = file ? formatFileSize(file.size) : existing ? 'Already uploaded' : null;
  const canRemove = Boolean(file);

  function resetInput() {
    if (inputRef.current) inputRef.current.value = '';
  }

  function apply(next: File | null) {
    if (!next) {
      setError(null);
      onChange(null);
      resetInput();
      return;
    }

    const result = acceptCreative(next);
    if (!result.ok) {
      setError(result.error);
      resetInput();
      return;
    }

    setError(null);
    onChange(result.file);
    resetInput();
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }

  function onDragLeave(event: DragEvent) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragging(false);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    apply(event.dataTransfer.files[0] ?? null);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={CREATIVE_ACCEPT}
        className="sr-only"
        onChange={(event) => apply(event.target.files?.[0] ?? null)}
      />

      {previewUrl && kind ? (
        <PreviewFrame
          name={previewName}
          kind={kind}
          previewUrl={previewUrl}
          sizeLabel={sizeLabel}
          canRemove={canRemove}
          dragging={dragging}
          inputId={inputId}
          onRemove={() => apply(null)}
          onOpen={() => setLightbox(true)}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors',
            dragging
              ? 'border-brand-500 bg-brand-50/60'
              : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50',
          )}
        >
          <Upload className="size-5 text-slate-400" aria-hidden />
          <span className="mt-3 text-[13px] font-medium text-slate-700">
            {dragging ? 'Drop to preview' : 'Choose a PDF or PNG'}
          </span>
          <span className="mt-1 text-[11px] text-slate-400">
            Up to 25 MB. Stored against your account; Azure Blob later uses the same key.
          </span>
        </label>
      )}

      {error ? <FormError message={error} /> : null}

      {kind === 'png' && previewUrl ? (
        <ArtworkLightbox
          open={lightbox}
          onOpenChange={setLightbox}
          title={previewName}
          src={previewUrl}
        />
      ) : null}
    </div>
  );
}

function PreviewFrame({
  name,
  kind,
  previewUrl,
  sizeLabel,
  canRemove,
  dragging,
  inputId,
  onRemove,
  onOpen,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  name: string;
  kind: CreativeKind;
  previewUrl: string;
  sizeLabel: string | null;
  canRemove: boolean;
  dragging: boolean;
  inputId: string;
  onRemove: () => void;
  onOpen: () => void;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'overflow-hidden rounded-xl border bg-white transition-colors',
        dragging ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200',
      )}
    >
      {kind === 'png' ? (
        <button
          type="button"
          onClick={onOpen}
          className="group relative block w-full focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
        >
          <div className="flex max-h-[360px] min-h-[200px] items-center justify-center bg-[length:16px_16px] bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#ffffff_0%_50%)]">
            <img
              src={previewUrl}
              alt={`Preview of ${name}`}
              className="max-h-[360px] w-full object-contain"
            />
          </div>
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-slate-900/55 py-2 text-[12px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Expand className="size-3.5" aria-hidden />
            View full size
          </span>
        </button>
      ) : (
        <iframe
          title={`Preview of ${name}`}
          src={`${previewUrl}#toolbar=0&navpanes=0`}
          className="h-[420px] w-full bg-slate-50"
        />
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          {kind === 'png' ? (
            <ImageIcon className="size-4" aria-hidden />
          ) : (
            <FileText className="size-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-slate-800">{name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <Badge tone="info">{kind === 'png' ? 'PNG' : 'PDF'}</Badge>
            {sizeLabel ? <span>{sizeLabel}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {kind === 'pdf' ? (
            <Button type="button" variant="ghost" size="sm" asChild>
              <a href={previewUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" asChild>
            <label htmlFor={inputId} className="cursor-pointer">
              Replace
            </label>
          </Button>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              leadingIcon={<Trash2 className="size-3.5" />}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ArtworkLightbox({
  open,
  onOpenChange,
  title,
  src,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  src: string;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="popover-anim fixed inset-0 z-50 bg-slate-950/80" />
        <RDialog.Content className="popover-anim fixed inset-3 z-50 flex flex-col outline-none sm:inset-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <RDialog.Title className="truncate text-[13px] font-medium text-white">
                {title}
              </RDialog.Title>
              <RDialog.Description className="sr-only">
                Full-size preview of the campaign creative.
              </RDialog.Description>
            </div>
            <RDialog.Close
              className="grid size-8 shrink-0 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </RDialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
            <img src={src} alt="" className="max-h-full max-w-full object-contain shadow-2xl" />
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
