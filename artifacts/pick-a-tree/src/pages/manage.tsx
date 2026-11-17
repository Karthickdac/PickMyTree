import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { AlertTriangle, Archive, ArrowLeft, CheckCircle2, ClipboardList, ExternalLink, ImageOff, Loader2, Lock, MapPin, Pencil, Plus, RefreshCw, Sprout, Tractor, TreeDeciduous } from 'lucide-react';
import {
  getGetMeQueryKey, getListManagedTreesQueryKey, useCreateManagedFarm, useCreateManagedTree, useGetMe, useListManagedFarms, useListManagedTrees,
  useUpdateManagedFarm, useUpdateManagedTree,
  type CatalogueImage, type FarmEditorInputStatus, type ManagedFarm, type ManagedTree, type TreeEditorInputSpecies, type TreeEditorInputStatus,
} from '@workspace/api-client-react';
import { AppHeading, AppShell, type NavItem } from '@/components/app-shell';
import { EmptyState, ErrorState, StatusPill } from '@/components/site/bits';
import { ImageManager } from '@/components/manage/image-manager';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, errorStatus, humanize, useSeo } from '@/lib/brand';
import { canManageFarms, saveErrorText, useInvalidateCatalogue } from '@/lib/manage';
import { cn } from '@/lib/utils';

const NAV: NavItem[] = [
  { href: '/manage/farms', label: 'Farms', icon: Tractor },
  { href: '/workspace', label: 'Operations workspace', icon: ClipboardList },
];

function ManageShell({ children }: { children: ReactNode }) {
  const { data: me } = useGetMe();
  const navigation = me?.roles.some(r => ['administrator', 'super-administrator'].includes(r)) ? [NAV[0], { href: '/manage/schemes', label: 'Customize schemes', icon: ClipboardList }, { href: '/manage/adoption-readiness', label: 'Adoption readiness', icon: CheckCircle2 }, ...NAV.slice(1)] : NAV;
  return <AppShell nav={navigation} zone="Farm management" footerLink={<Link href="/farms" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-harvest hover:bg-sidebar-accent" data-testid="link-public-farms">View public farms <ExternalLink className="h-3.5 w-3.5" /></Link>}>{children}</AppShell>;
}

function RoleGuidance() {
  const { data: me } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  return (
    <EmptyState icon={<Lock className="h-6 w-6" />} title="Farm management needs a management role." body={
      <span className="block space-y-3 text-left">
        <span className="block">You are signed in{me ? ` as ${me.profile.displayName || me.displayName}` : ''}, but your account does not hold the administrator, super-administrator or farm-manager role required to edit farms and trees.</span>
        <span className="block">Ask an existing verified administrator to grant your verified mobile number a role. Roles cannot be self-assigned, and there is no public editing.</span>
        {me && <span className="block font-mono text-xs">Current roles: {me.roles.length ? me.roles.join(', ') : 'none'}</span>}
      </span>
    }>
      <Link href="/portal" className="rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="link-guidance-portal">Go to my portal</Link>
    </EmptyState>
  );
}

function SampleTag({ className }: { className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border border-harvest/40 bg-harvest/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-soil', className)} data-testid="badge-details-pending"><ClipboardList className="h-3 w-3" />Details pending</span>;
}

function Field({ label, hint, error, htmlFor, children, required }: { label: string; hint?: string; error?: string; htmlFor: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-emerald">{label}{required ? <span className="text-harvest"> *</span> : <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}</Label>
      {children}
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SaveBanner({ error, onReload }: { error: unknown; onReload?: () => void }) {
  if (!error) return null;
  const conflict = errorStatus(error) === 409;
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" data-testid="alert-save-error">
      <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{saveErrorText(error)}</span>
      {conflict && onReload && <button type="button" onClick={onReload} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground" data-testid="button-reload-latest"><RefreshCw className="h-3.5 w-3.5" />Reload latest</button>}
    </div>
  );
}

/* ---------------- Farm form ---------------- */

type FarmDraft = { name: string; district: string; description: string; location: string; areaAcres: string; status: FarmEditorInputStatus; images: CatalogueImage[] };
const emptyFarm: FarmDraft = { name: '', district: '', description: '', location: '', areaAcres: '', status: 'draft', images: [] };
const farmToDraft = (f: ManagedFarm): FarmDraft => ({ name: f.name, district: f.district, description: f.description, location: f.location ?? '', areaAcres: String(f.areaAcres ?? 0), status: f.status, images: f.images ?? [] });

function validateFarm(d: FarmDraft) {
  const e: Partial<Record<keyof FarmDraft, string>> = {};
  if (d.name.trim().length < 2) e.name = 'At least 2 characters.';
  if (d.district.trim().length < 2) e.district = 'At least 2 characters.';
  if (d.description.trim().length < 5) e.description = 'At least 5 characters.';
  if (d.location.length > 300) e.location = 'At most 300 characters.';
  const a = Number(d.areaAcres);
  if (d.areaAcres.trim() === '' || !Number.isFinite(a) || a < 0 || a > 100000) e.areaAcres = 'Enter a number between 0 and 100000.';
  return e;
}
const farmPayload = (d: FarmDraft) => ({ name: d.name.trim(), district: d.district.trim(), description: d.description.trim(), location: d.location.trim(), areaAcres: Number(d.areaAcres), status: d.status, imageIds: d.images.map((i) => i.id) });

function FarmForm({ draft, setDraft, errors, onPending, disabled, showImages }: { draft: FarmDraft; setDraft: (d: FarmDraft) => void; errors: Partial<Record<keyof FarmDraft, string>>; onPending: (p: boolean) => void; disabled?: boolean; showImages: boolean }) {
  const set = <K extends keyof FarmDraft>(k: K, v: FarmDraft[K]) => setDraft({ ...draft, [k]: v });
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Farm name" htmlFor="farm-name" required error={errors.name}><Input id="farm-name" value={draft.name} maxLength={180} onChange={(e) => set('name', e.target.value)} disabled={disabled} className="bg-card" data-testid="input-farm-name" /></Field>
        <Field label="District" htmlFor="farm-district" required error={errors.district}><Input id="farm-district" value={draft.district} maxLength={120} onChange={(e) => set('district', e.target.value)} disabled={disabled} placeholder="e.g. Dindigul" className="bg-card" data-testid="input-farm-district" /></Field>
        <Field label="Area (acres)" htmlFor="farm-area" required error={errors.areaAcres}><Input id="farm-area" inputMode="decimal" value={draft.areaAcres} onChange={(e) => set('areaAcres', e.target.value)} disabled={disabled} placeholder="0" className="bg-card" data-testid="input-farm-area" /></Field>
        <Field label="Status" htmlFor="farm-status" required hint="Only listed farms appear publicly. Archiving hides without erasing.">
          <Select value={draft.status} onValueChange={(v) => set('status', v as FarmEditorInputStatus)} disabled={disabled}>
            <SelectTrigger id="farm-status" className="bg-card" data-testid="select-farm-status"><SelectValue /></SelectTrigger>
            <SelectContent>{(['draft', 'listed', 'archived'] as const).map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Public location label" htmlFor="farm-location" error={errors.location} hint="A general area only, such as a village or taluk. Never an exact address or GPS point.">
        <Input id="farm-location" value={draft.location} maxLength={300} onChange={(e) => set('location', e.target.value)} disabled={disabled} className="bg-card" data-testid="input-farm-location" />
      </Field>
      <Field label="Description" htmlFor="farm-description" required error={errors.description} hint="Describe what is actually there. No yield, harvest or certification claims that are not verified.">
        <Textarea id="farm-description" rows={5} value={draft.description} maxLength={5000} onChange={(e) => set('description', e.target.value)} disabled={disabled} className="bg-card" data-testid="input-farm-description" />
      </Field>
      {showImages && (
        <div>
          <p className="mb-3 text-sm font-medium text-emerald">Catalogue photos</p>
          <ImageManager idPrefix="farm" images={draft.images} onChange={(images) => setDraft({ ...draft, images })} onPendingChange={onPending} disabled={disabled} />
        </div>
      )}
    </div>
  );
}

/* ---------------- Directory ---------------- */

export function ManageFarmsPage() {
  useSeo('Manage farms', 'Private farm and tree management.');
  const { data: me } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const { data, isLoading, isError, error, refetch } = useListManagedFarms();
  const [creating, setCreating] = useState(false);
  const roleOk = canManageFarms(me?.roles);

  let body: ReactNode;
  if ((isError && errorStatus(error) === 403) || (me && !roleOk && !data)) body = <RoleGuidance />;
  else if (isError) body = <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  else if (isLoading) body = <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-64 rounded-[1.75rem]" />)}</div>;
  else if (data) body = (
    <>
      {!data.storageAvailable && <div className="mb-6 flex items-start gap-2 rounded-2xl border border-harvest/35 bg-harvest/8 p-4 text-sm text-soil" data-testid="notice-storage"><AlertTriangle className="mt-0.5 h-4 w-4" />Photo storage is not reachable right now. You can edit details; photo uploads may fail until storage responds.</div>}
      {data.items.length === 0 ? (
        <EmptyState icon={<Tractor className="h-6 w-6" />} title="No farms registered yet." body="Create the first farm as a draft. It stays private until you set it to Listed.">
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-harvest px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="button-empty-new-farm">New farm</button>
        </EmptyState>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {data.items.map((f) => (
            <Link key={f.id} href={`/manage/farms/${f.id}`} className="group overflow-hidden rounded-[1.75rem] border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-leaf hover:shadow-md" data-testid={`card-managed-farm-${f.id}`}>
              <div className="relative aspect-[16/8] bg-secondary">
                {f.images?.[0] ? <img src={f.images[0].url} alt={f.images[0].name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-leaf/50"><ImageOff className="h-10 w-10" strokeWidth={1.25} /></div>}
                <div className="absolute left-3 top-3 flex gap-2"><StatusPill status={f.status} className="bg-card/90" />{f.isSample && <SampleTag className="bg-card/90" />}</div>
              </div>
              <div className="flex items-end justify-between gap-4 p-6">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{f.district}</p>
                  <h3 className="mt-1 truncate font-display text-2xl text-emerald">{f.name}</h3>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{f.treeCount} trees · {f.areaAcres} acres · {f.images?.length ?? 0} photos · v{f.version}</p>
                </div>
                <Pencil className="h-5 w-5 shrink-0 text-emerald transition-transform group-hover:-rotate-12" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );

  return (
    <ManageShell>
      <AppHeading eyebrow="Farm management" title="Farms you look after">
        {data && <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-full bg-harvest px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="button-new-farm"><Plus className="h-4 w-4" />New farm</button>}
      </AppHeading>
      {body}
      <CreateFarmSheet open={creating} onOpenChange={setCreating} />
    </ManageShell>
  );
}

function CreateFarmSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [draft, setDraft] = useState<FarmDraft>(emptyFarm);
  const [errors, setErrors] = useState<Partial<Record<keyof FarmDraft, string>>>({});
  const [pending, setPending] = useState(false);
  const create = useCreateManagedFarm();
  const invalidate = useInvalidateCatalogue();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  useEffect(() => { if (open) { setDraft(emptyFarm); setErrors({}); create.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    const e = validateFarm(draft); setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const farm = await create.mutateAsync({ data: farmPayload(draft) });
      await invalidate(farm.id);
      toast({ title: 'Farm created', description: `${farm.name} saved as ${humanize(farm.status).toLowerCase()}.` });
      onOpenChange(false);
      navigate(`/manage/farms/${farm.id}`);
    } catch { /* surfaced via create.error */ }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader><SheetTitle className="font-display text-3xl font-light text-emerald">New farm</SheetTitle><SheetDescription>New farms are real records and start as private drafts.</SheetDescription></SheetHeader>
        <div className="mt-6 space-y-5">
          <FarmForm draft={draft} setDraft={setDraft} errors={errors} onPending={setPending} disabled={create.isPending} showImages />
          <SaveBanner error={create.error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} disabled={create.isPending} className="rounded-full border border-border px-5 py-2.5 text-sm font-medium" data-testid="button-cancel-farm">Cancel</button>
            <button type="button" onClick={submit} disabled={create.isPending || pending} className="inline-flex items-center gap-2 rounded-full bg-emerald px-6 py-2.5 text-sm font-semibold text-ivory disabled:opacity-50" data-testid="button-create-farm">
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? 'Waiting for uploads' : 'Create farm'}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Detail ---------------- */

export function ManageFarmDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useListManagedFarms();
  const farm = data?.items.find((f) => f.id === id);
  useSeo(farm ? `Manage ${farm.name}` : 'Manage farm', 'Private farm editing.');

  let body: ReactNode;
  if (isError && errorStatus(error) === 403) body = <RoleGuidance />;
  else if (isError) body = <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  else if (isLoading) body = <div className="space-y-4"><Skeleton className="h-14 w-1/2" /><Skeleton className="h-96 rounded-[1.75rem]" /></div>;
  else if (!farm) body = <EmptyState icon={<Tractor className="h-6 w-6" />} title="Farm not found." body="It may not exist, or your role does not cover it."><Link href="/manage/farms" className="rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="link-back-farms">All farms</Link></EmptyState>;
  else body = <FarmDetail key={farm.id} farm={farm} reloadFarm={() => refetch()} />;

  return (
    <ManageShell>
      <Link href="/manage/farms" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald" data-testid="link-manage-back"><ArrowLeft className="h-4 w-4" />All farms</Link>
      {body}
    </ManageShell>
  );
}

function FarmDetail({ farm, reloadFarm }: { farm: ManagedFarm; reloadFarm: () => Promise<unknown> }) {
  const [draft, setDraft] = useState<FarmDraft>(() => farmToDraft(farm));
  const [errors, setErrors] = useState<Partial<Record<keyof FarmDraft, string>>>({});
  const [pending, setPending] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const baseVersion = useRef(farm.version);
  const update = useUpdateManagedFarm();
  const invalidate = useInvalidateCatalogue();
  const { toast } = useToast();
  const dirty = JSON.stringify(farmPayload(draft)) !== JSON.stringify(farmPayload(farmToDraft(farm)));

  async function save() {
    const e = validateFarm(draft); setErrors(e);
    if (Object.keys(e).length) { toast({ title: 'Check the highlighted fields', variant: 'destructive' }); return; }
    try {
      const saved = await update.mutateAsync({ farmId: farm.id, data: { ...farmPayload(draft), version: baseVersion.current } });
      baseVersion.current = saved.version;
      setDraft(farmToDraft(saved));
      await invalidate(farm.id);
      setSavedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      toast({ title: 'Farm saved', description: `Version ${saved.version} · ${humanize(saved.status)}` });
    } catch { /* surfaced */ }
  }

  async function reload() {
    await reloadFarm();
    update.reset();
  }
  // When the farm record refreshes after a reload, adopt it only if user asked (conflict) or nothing is dirty
  useEffect(() => {
    if (farm.version !== baseVersion.current && (!dirty || update.error)) {
      baseVersion.current = farm.version; setDraft(farmToDraft(farm)); update.reset();
    }
  }, [farm]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2"><StatusPill status={farm.status} />{farm.isSample && <SampleTag />}<span className="font-mono text-xs text-muted-foreground">v{farm.version}</span></div>
          <h1 className="mt-3 text-4xl font-light text-emerald md:text-5xl" data-testid="text-app-title">{farm.name}</h1>
          {farm.isSample && <p className="mt-2 max-w-xl text-sm text-muted-foreground">Update the farm details and upload your photos here. Verification is required before adoption can open.</p>}
        </div>
        {farm.status === 'listed' && <Link href="/farms" className="inline-flex items-center gap-1.5 text-sm font-medium text-leaf hover:underline" data-testid="link-view-public">See it publicly <ExternalLink className="h-3.5 w-3.5" /></Link>}
      </div>

      <section className="rounded-[1.75rem] border border-border bg-card/60 p-5 md:p-8">
        <div className="mb-6 flex items-center justify-between"><h2 className="font-display text-2xl text-emerald">Farm details</h2>
          <span className="font-mono text-xs text-muted-foreground" data-testid="text-farm-save-state">{update.isPending ? 'Saving...' : dirty ? 'Unsaved changes' : savedAt ? `Saved at ${savedAt}` : 'Up to date'}</span></div>
        <FarmForm draft={draft} setDraft={setDraft} errors={errors} onPending={setPending} disabled={update.isPending} showImages />
        <div className="mt-6 space-y-4">
          <SaveBanner error={update.error} onReload={reload} />
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-2 rounded-full border border-border bg-background/90 p-2 backdrop-blur-md">
            {dirty && <button type="button" disabled={update.isPending} onClick={() => { setDraft(farmToDraft(farm)); setErrors({}); update.reset(); }} className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-emerald" data-testid="button-discard-farm">Discard</button>}
            <button type="button" onClick={save} disabled={!dirty || pending || update.isPending} className="inline-flex items-center gap-2 rounded-full bg-emerald px-6 py-2.5 text-sm font-semibold text-ivory disabled:opacity-45" data-testid="button-save-farm">
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{pending ? 'Waiting for uploads' : 'Save farm'}
            </button>
          </div>
        </div>
      </section>

      <TreesSection farm={farm} />
    </>
  );
}

/* ---------------- Trees ---------------- */

type TreeDraft = { name: string; species: TreeEditorInputSpecies; variety: string; zone: string; age: string; description: string; condition: string; status: TreeEditorInputStatus; images: CatalogueImage[] };
const emptyTree: TreeDraft = { name: '', species: 'Mango', variety: '', zone: '', age: '', description: '', condition: '', status: 'draft', images: [] };
const treeToDraft = (t: ManagedTree): TreeDraft => ({ name: t.name, species: t.species, variety: t.variety, zone: t.zone ?? '', age: t.age ?? '', description: t.description, condition: t.condition ?? '', status: t.status, images: t.images ?? [] });
const treePayload = (d: TreeDraft) => ({ name: d.name.trim(), species: d.species, variety: d.variety.trim(), zone: d.zone.trim(), age: d.age.trim(), description: d.description.trim(), condition: d.condition.trim(), status: d.status, imageIds: d.images.map((i) => i.id) });
function validateTree(d: TreeDraft) {
  const e: Partial<Record<keyof TreeDraft, string>> = {};
  if (d.name.trim().length < 2) e.name = 'At least 2 characters.';
  if (d.variety.trim().length < 2) e.variety = 'At least 2 characters.';
  if (d.description.trim().length < 5) e.description = 'At least 5 characters.';
  return e;
}
const TREE_STATUSES = ['draft', 'listed', 'temporarily-unavailable', 'archived'] as const;

function TreesSection({ farm }: { farm: ManagedFarm }) {
  const { data: trees, isLoading, isError, error, refetch } = useListManagedTrees(farm.id, { query: { enabled: !!farm.id, queryKey: getListManagedTreesQueryKey(farm.id) } });
  const [editing, setEditing] = useState<ManagedTree | 'new' | null>(null);
  const [archiving, setArchiving] = useState<ManagedTree | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const update = useUpdateManagedTree();
  const invalidate = useInvalidateCatalogue();
  const { toast } = useToast();
  const visible = (trees ?? []).filter((t) => showArchived || t.status !== 'archived');
  const archivedCount = (trees ?? []).filter((t) => t.status === 'archived').length;

  async function confirmArchive() {
    if (!archiving) return;
    try {
      const saved = await update.mutateAsync({ treeId: archiving.id, data: { ...treePayload(treeToDraft(archiving)), status: 'archived', version: archiving.version } });
      await invalidate(farm.id);
      toast({ title: 'Tree archived', description: `${saved.treeCode} is no longer public. The record is kept.` });
      setArchiving(null);
    } catch (err) {
      toast({ title: 'Could not archive', description: saveErrorText(err), variant: 'destructive' });
      if (errorStatus(err) === 409) { await refetch(); setArchiving(null); }
    }
  }

  return (
    <section className="mt-14">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="eyebrow text-leaf">Registered trees</p><h2 className="mt-2 font-display text-3xl font-light text-emerald">Trees on {farm.name}</h2></div>
        <div className="flex flex-wrap items-center gap-2">
          {archivedCount > 0 && <button type="button" onClick={() => setShowArchived((s) => !s)} className="rounded-full border border-border px-4 py-2 text-sm" data-testid="button-toggle-archived">{showArchived ? 'Hide' : 'Show'} archived ({archivedCount})</button>}
          <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-full bg-harvest px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="button-new-tree"><Plus className="h-4 w-4" />Register tree</button>
        </div>
      </div>
      {isError ? (errorStatus(error) === 403 ? <RoleGuidance /> : <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />) : isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<Sprout className="h-6 w-6" />} title={archivedCount ? 'Only archived trees here.' : 'No trees registered yet.'} body="Each tree gets a permanent code when you register it. New trees start as private drafts.">
          <button type="button" onClick={() => setEditing('new')} className="rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="button-empty-new-tree">Register the first tree</button>
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => (
            <li key={t.id} className={cn('flex flex-col gap-4 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center', t.status === 'archived' && 'opacity-60')} data-testid={`row-tree-${t.id}`}>
              <div className="h-20 w-full shrink-0 overflow-hidden rounded-xl bg-secondary sm:w-28">
                {t.images?.[0] ? <img src={t.images[0].url} alt={t.images[0].name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-leaf/50"><TreeDeciduous className="h-8 w-8" strokeWidth={1.25} /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-harvest" data-testid={`text-tree-code-${t.id}`}>{t.treeCode}</span><StatusPill status={t.status} />{t.isSample && <SampleTag />}</div>
                <p className="mt-1 truncate font-display text-xl text-emerald">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.species} · {t.variety}{t.zone ? ` · ${t.zone}` : ''} · {t.images?.length ?? 0} photos</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(t)} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-emerald" data-testid={`button-edit-tree-${t.id}`}><Pencil className="h-3.5 w-3.5" />Edit</button>
                {t.status !== 'archived' && <button type="button" onClick={() => setArchiving(t)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:border-destructive hover:text-destructive" data-testid={`button-archive-tree-${t.id}`}><Archive className="h-3.5 w-3.5" />Archive</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <TreeEditorSheet farmId={farm.id} tree={editing} onClose={() => setEditing(null)} onConflictReload={() => refetch()} />

      <AlertDialog open={!!archiving} onOpenChange={(o) => !o && !update.isPending && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal text-emerald">Archive {archiving?.treeCode}?</AlertDialogTitle>
            <AlertDialogDescription>The tree disappears from the public catalogue. Its record, code and photos stay here, and you can set it back to draft or listed later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={update.isPending} data-testid="button-cancel-archive">Keep listed</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmArchive(); }} disabled={update.isPending} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-archive">
              {update.isPending ? 'Archiving...' : 'Archive tree'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function TreeEditorSheet({ farmId, tree, onClose, onConflictReload }: { farmId: string; tree: ManagedTree | 'new' | null; onClose: () => void; onConflictReload: () => Promise<unknown> }) {
  const isNew = tree === 'new';
  const existing = tree && tree !== 'new' ? tree : null;
  const [draft, setDraft] = useState<TreeDraft>(emptyTree);
  const [errors, setErrors] = useState<Partial<Record<keyof TreeDraft, string>>>({});
  const [pending, setPending] = useState(false);
  const [version, setVersion] = useState(1);
  const create = useCreateManagedTree();
  const update = useUpdateManagedTree();
  const invalidate = useInvalidateCatalogue();
  const { toast } = useToast();
  const busy = create.isPending || update.isPending;
  const saveError = isNew ? create.error : update.error;

  useEffect(() => {
    if (!tree) return;
    setDraft(existing ? treeToDraft(existing) : emptyTree);
    setVersion(existing?.version ?? 1);
    setErrors({}); create.reset(); update.reset();
  }, [tree]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof TreeDraft>(k: K, v: TreeDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    const e = validateTree(draft); setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const saved = isNew
        ? await create.mutateAsync({ farmId, data: treePayload(draft) })
        : await update.mutateAsync({ treeId: existing!.id, data: { ...treePayload(draft), version } });
      await invalidate(farmId);
      toast({ title: isNew ? 'Tree registered' : 'Tree saved', description: `${saved.treeCode} · ${humanize(saved.status)} · v${saved.version}` });
      onClose();
    } catch { /* surfaced */ }
  }

  async function reload() {
    const fresh = (await onConflictReload()) as { data?: ManagedTree[] } | undefined;
    const latest = fresh?.data?.find((t) => t.id === existing?.id);
    if (latest) { setDraft(treeToDraft(latest)); setVersion(latest.version); }
    update.reset();
  }

  return (
    <Sheet open={!!tree} onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-display text-3xl font-light text-emerald">{isNew ? 'Register a tree' : existing?.name}</SheetTitle>
          <SheetDescription>{isNew ? 'A permanent tree code is assigned on save and never changes.' : <span className="flex flex-wrap items-center gap-2"><span className="font-mono text-harvest">{existing?.treeCode}</span> permanent code · v{version}{existing?.isSample && <SampleTag />}</span>}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Tree name" htmlFor="tree-name" required error={errors.name}><Input id="tree-name" value={draft.name} maxLength={180} onChange={(e) => set('name', e.target.value)} disabled={busy} className="bg-card" data-testid="input-tree-name" /></Field>
            <Field label="Species" htmlFor="tree-species" required>
              <Select value={draft.species} onValueChange={(v) => set('species', v as TreeEditorInputSpecies)} disabled={busy}>
                <SelectTrigger id="tree-species" className="bg-card" data-testid="select-tree-species"><SelectValue /></SelectTrigger>
                <SelectContent>{(['Mango', 'Guava', 'Coconut'] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Variety" htmlFor="tree-variety" required error={errors.variety}><Input id="tree-variety" value={draft.variety} maxLength={120} onChange={(e) => set('variety', e.target.value)} disabled={busy} placeholder="e.g. Imam Pasand" className="bg-card" data-testid="input-tree-variety" /></Field>
            <Field label="Status" htmlFor="tree-status" required hint="Listed shows publicly. Adoption still needs approved terms.">
              <Select value={draft.status} onValueChange={(v) => set('status', v as TreeEditorInputStatus)} disabled={busy}>
                <SelectTrigger id="tree-status" className="bg-card" data-testid="select-tree-status"><SelectValue /></SelectTrigger>
                <SelectContent>{TREE_STATUSES.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Zone or block" htmlFor="tree-zone"><Input id="tree-zone" value={draft.zone} maxLength={120} onChange={(e) => set('zone', e.target.value)} disabled={busy} className="bg-card" data-testid="input-tree-zone" /></Field>
            <Field label="Estimated age" htmlFor="tree-age"><Input id="tree-age" value={draft.age} maxLength={100} onChange={(e) => set('age', e.target.value)} disabled={busy} placeholder="e.g. About 12 years" className="bg-card" data-testid="input-tree-age" /></Field>
          </div>
          <Field label="Condition note" htmlFor="tree-condition" hint="What you observed. Not a guarantee of fruit."><Input id="tree-condition" value={draft.condition} maxLength={500} onChange={(e) => set('condition', e.target.value)} disabled={busy} className="bg-card" data-testid="input-tree-condition" /></Field>
          <Field label="Description" htmlFor="tree-description" required error={errors.description}><Textarea id="tree-description" rows={4} value={draft.description} maxLength={5000} onChange={(e) => set('description', e.target.value)} disabled={busy} className="bg-card" data-testid="input-tree-description" /></Field>
          <div>
            <p className="mb-3 text-sm font-medium text-emerald">Tree photos</p>
            <ImageManager idPrefix="tree" images={draft.images} onChange={(images) => setDraft((d) => ({ ...d, images }))} onPendingChange={setPending} disabled={busy} />
          </div>
          <SaveBanner error={saveError} onReload={isNew ? undefined : reload} />
          <div className="flex justify-end gap-2 pb-4">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-border px-5 py-2.5 text-sm font-medium" data-testid="button-cancel-tree">Cancel</button>
            <button type="button" onClick={save} disabled={busy || pending} className="inline-flex items-center gap-2 rounded-full bg-emerald px-6 py-2.5 text-sm font-semibold text-ivory disabled:opacity-50" data-testid="button-save-tree">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? 'Waiting for uploads' : isNew ? 'Register tree' : 'Save tree'}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
