import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  getGetCustomerDashboardQueryKey, getGetWorkspaceSummaryQueryKey, getListRecordsQueryKey,
  useCreateRecord, useUpdateRecord, type Field, type Module, type PlatformRecord,
} from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, formatDate, humanize } from '@/lib/brand';
import { StatusPill } from '@/components/site/bits';

type Values = Record<string, string | boolean>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINKS_FARM_TREE = new Set(['zones', 'trees', 'updates', 'tasks', 'assessments', 'recommendations', 'harvest', 'batches']);

export function useInvalidateRecords() {
  const qc = useQueryClient();
  return (module: string) => {
    qc.invalidateQueries({ queryKey: getListRecordsQueryKey(module).slice(0, 1) });
    qc.invalidateQueries({ queryKey: getGetWorkspaceSummaryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCustomerDashboardQueryKey() });
  };
}

function initialValues(fields: Field[], record?: PlatformRecord): Values {
  const v: Values = { title: record?.title ?? '', farmId: record?.farmId ?? '', treeId: record?.treeId ?? '' };
  for (const f of fields) {
    const raw = record?.data?.[f.key];
    v[f.key] = f.type === 'boolean' ? raw === true : raw === undefined || raw === null ? '' : String(raw);
  }
  return v;
}

function toData(fields: Field[], v: Values) {
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    const val = v[f.key];
    if (f.type === 'boolean') data[f.key] = val === true;
    else if (val === '' || val === undefined) continue;
    else if (f.type === 'number') data[f.key] = Number(val);
    else data[f.key] = val;
  }
  return data;
}

function FieldInput({ field, value, onChange }: { field: Field; value: string | boolean; onChange: (v: string | boolean) => void }) {
  const id = `field-${field.key}`;
  if (field.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-3">
        <Label htmlFor={id} className="font-normal">{field.label}</Label>
        <Switch id={id} checked={value === true} onCheckedChange={onChange} data-testid={`input-${field.key}`} />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}{field.required && <span className="text-harvest"> *</span>}</Label>
      {field.type === 'textarea' ? (
        <Textarea id={id} rows={4} value={String(value)} onChange={(e) => onChange(e.target.value)} className="bg-background" data-testid={`input-${field.key}`} />
      ) : field.type === 'select' ? (
        <Select value={String(value) || undefined} onValueChange={onChange}>
          <SelectTrigger id={id} className="bg-background" data-testid={`select-${field.key}`}><SelectValue placeholder="Choose…" /></SelectTrigger>
          <SelectContent>{(field.options ?? []).map((o) => <SelectItem key={o} value={o}>{humanize(o)}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <Input id={id} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} step="any" value={String(value)} onChange={(e) => onChange(e.target.value)} className="bg-background" data-testid={`input-${field.key}`} />
      )}
      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
    </div>
  );
}

export function RecordFormDialog({ module, record, open, onOpenChange, titleLabel = 'Title' }: {
  module: Module; record?: PlatformRecord; open: boolean; onOpenChange: (o: boolean) => void; titleLabel?: string;
}) {
  const [values, setValues] = useState<Values>(() => initialValues(module.fields, record));
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const create = useCreateRecord();
  const update = useUpdateRecord();
  const invalidate = useInvalidateRecords();
  const { toast } = useToast();
  const linkable = LINKS_FARM_TREE.has(module.key);
  const pending = create.isPending || update.isPending;

  const submit = () => {
    setErr(null);
    const title = String(values.title).trim();
    if (title.length < 2) return setErr('Title needs at least 2 characters.');
    const missing = module.fields.find((f) => f.required && f.type !== 'boolean' && String(values[f.key]).trim() === '');
    if (missing) return setErr(`${missing.label} is required.`);
    const farmId = String(values.farmId).trim(); const treeId = String(values.treeId).trim();
    if ((farmId && !UUID.test(farmId)) || (treeId && !UUID.test(treeId))) return setErr('Farm and tree references must be valid record IDs.');
    const data = toData(module.fields, values);
    const done = () => { invalidate(module.key); toast({ title: record ? 'Record updated' : 'Record created' }); onOpenChange(false); };
    if (record) {
      if (reason.trim().length < 5) return setErr('Please give a reason of at least 5 characters.');
      update.mutate({ module: module.key, id: record.id, data: { version: record.version, reason: reason.trim(), title, data } }, { onSuccess: done, onError: (e) => setErr(errorMessage(e)) });
    } else {
      create.mutate({ module: module.key, data: { title, data, ...(linkable ? { farmId: farmId || null, treeId: treeId || null } : {}) } }, { onSuccess: done, onError: (e) => setErr(errorMessage(e)) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal text-emerald">{record ? `Edit ${record.title}` : `New ${module.title.toLowerCase()}`}</DialogTitle>
          <DialogDescription>{module.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="field-title">{titleLabel}<span className="text-harvest"> *</span></Label>
            <Input id="field-title" value={String(values.title)} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} className="bg-background" data-testid="input-title" />
          </div>
          {module.fields.map((f) => (
            <FieldInput key={f.key} field={f} value={values[f.key] ?? ''} onChange={(val) => setValues((v) => ({ ...v, [f.key]: val }))} />
          ))}
          {linkable && !record && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="field-farmId">Farm record ID (optional)</Label><Input id="field-farmId" value={String(values.farmId)} onChange={(e) => setValues((v) => ({ ...v, farmId: e.target.value }))} className="bg-background font-mono text-xs" data-testid="input-farm-id" /></div>
              <div className="space-y-1.5"><Label htmlFor="field-treeId">Tree record ID (optional)</Label><Input id="field-treeId" value={String(values.treeId)} onChange={(e) => setValues((v) => ({ ...v, treeId: e.target.value }))} className="bg-background font-mono text-xs" data-testid="input-tree-id" /></div>
            </div>
          )}
          {record && (
            <div className="space-y-1.5"><Label htmlFor="field-reason">Reason for change<span className="text-harvest"> *</span></Label><Textarea id="field-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="bg-background" data-testid="input-reason" /><p className="text-xs text-muted-foreground">Recorded in the audit trail.</p></div>
          )}
          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-form-error">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-full px-5 py-2.5 text-sm font-medium hover:bg-secondary" data-testid="button-cancel">Cancel</button>
            <button type="button" onClick={submit} disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-emerald px-6 py-2.5 text-sm font-semibold text-ivory disabled:opacity-60" data-testid="button-save-record">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}{record ? 'Save changes' : 'Create'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TransitionDialog({ moduleKey, record, to, onClose }: { moduleKey: string; record: PlatformRecord; to: string | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const update = useUpdateRecord();
  const invalidate = useInvalidateRecords();
  const { toast } = useToast();
  const submit = () => {
    if (!to) return;
    update.mutate({ module: moduleKey, id: record.id, data: { version: record.version, reason: reason.trim(), status: to } }, {
      onSuccess: () => { invalidate(moduleKey); toast({ title: `Moved to ${humanize(to)}` }); setReason(''); onClose(); },
    });
  };
  return (
    <Dialog open={!!to} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal text-emerald">Move to {to ? humanize(to) : ''}</DialogTitle>
          <DialogDescription>{record.title} · currently <span className="font-mono">{record.status}</span> · version {record.version}</DialogDescription>
        </DialogHeader>
        <Label htmlFor="transition-reason">Reason (required, audited)</Label>
        <Textarea id="transition-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="input-transition-reason" />
        {update.isError && <p className="text-sm text-destructive">{errorMessage(update.error)}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2.5 text-sm hover:bg-secondary" data-testid="button-cancel-transition">Cancel</button>
          <button type="button" onClick={submit} disabled={reason.trim().length < 5 || update.isPending} className="inline-flex items-center gap-2 rounded-full bg-harvest px-6 py-2.5 text-sm font-semibold text-ivory disabled:opacity-50" data-testid="button-confirm-transition">
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Confirm
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RecordFields({ record, fields }: { record: PlatformRecord; fields?: Field[] }) {
  const entries = fields ? fields.map((f) => [f.label, record.data?.[f.key]] as const) : Object.entries(record.data ?? {}).map(([k, v]) => [humanize(k), v] as const);
  const shown = entries.filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">No details recorded.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {shown.map(([label, v]) => (
        <div key={label}><dt className="eyebrow text-[10px] text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-line text-sm">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'object' ? Object.entries(v as object).map(([a, b]) => `${humanize(a)}: ${String(b)}`).join(', ') : String(v)}</dd></div>
      ))}
    </dl>
  );
}

export function RecordRow({ record, onOpen }: { record: PlatformRecord; onOpen?: () => void }) {
  return (
    <button type="button" onClick={onOpen} disabled={!onOpen} className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors enabled:hover:border-leaf" data-testid={`row-record-${record.id}`}>
      <div className="min-w-0"><p className="truncate font-medium">{record.title}</p><p className="font-mono text-[11px] text-muted-foreground">{formatDate(record.createdAt)} · v{record.version}</p></div>
      <StatusPill status={record.status} />
    </button>
  );
}
