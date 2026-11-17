import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, ImagePlus, Loader2, RotateCcw, Star, X } from 'lucide-react';
import { useCompleteFarmImageUpload, useRequestFarmImageUpload, type CatalogueImage, type FarmImageUploadInputContentType } from '@workspace/api-client-react';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, saveErrorText } from '@/lib/manage';
import { cn } from '@/lib/utils';

type Upload = { key: string; name: string; preview: string; stage: 'requesting' | 'uploading' | 'processing' | 'error'; error?: string; file: File };

const STAGE_LABEL: Record<Upload['stage'], string> = {
  requesting: 'Preparing secure upload',
  uploading: 'Sending photo to storage',
  processing: 'Checking and re-encoding',
  error: 'Upload failed',
};
const STAGE_PCT: Record<Upload['stage'], number> = { requesting: 18, uploading: 55, processing: 85, error: 100 };

export function ImageManager({ images, onChange, onPendingChange, disabled, idPrefix }: {
  images: CatalogueImage[];
  onChange: (next: CatalogueImage[]) => void;
  onPendingChange: (pending: boolean) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestUpload = useRequestFarmImageUpload();
  const completeUpload = useCompleteFarmImageUpload();
  const requestRef = useRef(requestUpload.mutateAsync); requestRef.current = requestUpload.mutateAsync;
  const completeRef = useRef(completeUpload.mutateAsync); completeRef.current = completeUpload.mutateAsync;
  const imagesRef = useRef(images); imagesRef.current = images;
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const onPendingRef = useRef(onPendingChange); onPendingRef.current = onPendingChange;

  const pending = uploads.some((u) => u.stage !== 'error');
  useEffect(() => { onPendingRef.current(pending); }, [pending]);

  const patch = (key: string, p: Partial<Upload>) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...p } : u)));

  async function run(u: Upload) {
    try {
      patch(u.key, { stage: 'requesting', error: undefined });
      const { id, uploadURL } = await requestRef.current({ data: { name: u.file.name.slice(0, 200) || 'photo', contentType: u.file.type as FarmImageUploadInputContentType, size: u.file.size } });
      patch(u.key, { stage: 'uploading' });
      const res = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': u.file.type }, body: u.file });
      if (!res.ok) throw new Error(`Storage refused the file (HTTP ${res.status}).`);
      patch(u.key, { stage: 'processing' });
      const image = await completeRef.current({ imageId: id });
      const nextImages = [...imagesRef.current, image];
      imagesRef.current = nextImages;
      onChangeRef.current(nextImages);
      URL.revokeObjectURL(u.preview);
      setUploads((list) => list.filter((x) => x.key !== u.key));
    } catch (err) {
      patch(u.key, { stage: 'error', error: saveErrorText(err) });
    }
  }

  function pick(files: FileList | null) {
    if (!files) return;
    const room = MAX_IMAGES - images.length - uploads.length;
    const accepted: Upload[] = [];
    const rejected: Upload[] = [];
    Array.from(files).forEach((file, i) => {
      const base = { key: `${Date.now()}-${i}-${file.name}`, name: file.name, preview: '', file };
      if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) rejected.push({ ...base, stage: 'error', error: 'Only JPEG, PNG or WebP photos are accepted.' });
      else if (file.size > MAX_IMAGE_BYTES) rejected.push({ ...base, stage: 'error', error: `This file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 10 MB.` });
      else if (accepted.length >= room) rejected.push({ ...base, stage: 'error', error: `A listing holds at most ${MAX_IMAGES} photos.` });
      else accepted.push({ ...base, preview: URL.createObjectURL(file), stage: 'requesting' });
    });
    setUploads((list) => [...list, ...accepted, ...rejected]);
    accepted.forEach((u) => { void run(u); });
    if (inputRef.current) inputRef.current.value = '';
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...images]; const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-harvest/35 bg-harvest/8 px-4 py-3 text-sm text-soil" data-testid={`notice-${idPrefix}-photos-public`}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Photos here are public catalogue images. Never upload land records, IDs, agreements or any private document. The first photo is the cover.</span>
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card" data-testid={`card-${idPrefix}-image-${img.id}`}>
            <img src={img.url} alt={img.name} className="aspect-[4/3] w-full object-cover" />
            {i === 0 && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ivory"><Star className="h-3 w-3" />Cover</span>}
            {img.isIllustrative && <span className="absolute right-2 top-2 rounded-full bg-card/90 px-2 py-0.5 font-mono text-[10px] uppercase text-soil">Illustrative</span>}
            <div className="flex items-center justify-between gap-1 border-t border-border p-1.5">
              <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${img.name} earlier`} className="rounded-lg p-2 text-emerald hover:bg-secondary disabled:opacity-30" data-testid={`button-${idPrefix}-image-left-${img.id}`}><ArrowLeft className="h-4 w-4" /></button>
              {i !== 0 && <button type="button" disabled={disabled} onClick={() => onChange([img, ...images.filter((x) => x.id !== img.id)])} className="rounded-lg px-2 py-1 text-xs font-medium text-emerald hover:bg-secondary" data-testid={`button-${idPrefix}-image-cover-${img.id}`}>Make cover</button>}
              <button type="button" disabled={disabled || i === images.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${img.name} later`} className="rounded-lg p-2 text-emerald hover:bg-secondary disabled:opacity-30" data-testid={`button-${idPrefix}-image-right-${img.id}`}><ArrowRight className="h-4 w-4" /></button>
              <button type="button" disabled={disabled} onClick={() => onChange(images.filter((x) => x.id !== img.id))} aria-label={`Detach ${img.name}`} title="Detach from this listing" className="rounded-lg p-2 text-destructive hover:bg-destructive/10" data-testid={`button-${idPrefix}-image-remove-${img.id}`}><X className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
        {uploads.map((u) => (
          <li key={u.key} className={cn('relative overflow-hidden rounded-2xl border bg-card', u.stage === 'error' ? 'border-destructive/40' : 'border-leaf/40')} data-testid={`card-${idPrefix}-upload`}>
            {u.preview ? <img src={u.preview} alt="" className={cn('aspect-[4/3] w-full object-cover', u.stage !== 'error' && 'opacity-60')} /> : <div className="aspect-[4/3] bg-muted" />}
            <div className="p-2.5" role="status" aria-live="polite">
              <p className="truncate text-xs font-medium">{u.name}</p>
              <p className={cn('mt-1 flex items-center gap-1.5 text-[11px]', u.stage === 'error' ? 'text-destructive' : 'text-leaf')}>
                {u.stage !== 'error' && <Loader2 className="h-3 w-3 animate-spin" />}{STAGE_LABEL[u.stage]}
              </p>
              {u.stage !== 'error' && <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full origin-left bg-leaf transition-transform duration-500" style={{ transform: `scaleX(${STAGE_PCT[u.stage] / 100})` }} /></div>}
              {u.error && <p className="mt-1 text-[11px] leading-snug text-destructive">{u.error}</p>}
              {u.stage === 'error' && (
                <div className="mt-2 flex gap-2">
                  {u.preview && <button type="button" onClick={() => void run(u)} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald" data-testid={`button-${idPrefix}-upload-retry`}><RotateCcw className="h-3 w-3" />Retry</button>}
                  <button type="button" onClick={() => { if (u.preview) URL.revokeObjectURL(u.preview); setUploads((l) => l.filter((x) => x.key !== u.key)); }} className="text-xs text-muted-foreground underline" data-testid={`button-${idPrefix}-upload-dismiss`}>Dismiss</button>
                </div>
              )}
            </div>
          </li>
        ))}
        {images.length + uploads.filter((u) => u.stage !== 'error').length < MAX_IMAGES && (
          <li>
            <label className={cn('flex aspect-[4/3] h-full min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-leaf/40 bg-secondary/40 p-4 text-center text-sm text-emerald transition-colors hover:border-leaf hover:bg-secondary focus-within:ring-2 focus-within:ring-ring', disabled && 'pointer-events-none opacity-50')}>
              <ImagePlus className="h-6 w-6" />
              <span className="font-semibold">Add photos</span>
              <span className="text-[11px] text-muted-foreground">JPEG, PNG, WebP · up to 10 MB</span>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} className="sr-only" onChange={(e) => pick(e.target.files)} data-testid={`input-${idPrefix}-photos`} />
            </label>
          </li>
        )}
      </ol>
      <p className="font-mono text-[11px] text-muted-foreground" data-testid={`text-${idPrefix}-image-count`}>{images.length} / {MAX_IMAGES} attached{pending ? ' · uploads in progress, saving is paused' : ''}. Removing a photo only detaches it; changes apply when you save.</p>
    </div>
  );
}
