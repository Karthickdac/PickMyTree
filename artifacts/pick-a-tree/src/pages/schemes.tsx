import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ClipboardList, Copy, Eye, Leaf, Lock, Plus, Save, Tractor } from 'lucide-react';
import {
  useGetMe, useListManagedSchemes, useCreateManagedScheme, useGetManagedScheme,
  useUpdateManagedScheme, useListSchemeRevisions, getListManagedSchemesQueryKey, getManagedScheme,
  getGetManagedSchemeQueryKey, getListSchemeRevisionsQueryKey,
  type ManagedScheme, type SchemeEditorInput,
} from '@workspace/api-client-react';
import { AppShell, AppHeading, type NavItem } from '@/components/app-shell';
import { ErrorState, EmptyState, StatusPill } from '@/components/site/bits';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SchemeFields, newConfiguration } from '@/components/manage/scheme-fields';
import { errorMessage, formatDate, formatPaise, humanize, useSeo } from '@/lib/brand';

const nav: NavItem[] = [
  { href: '/manage/farms', label: 'Farms & trees', icon: Tractor },
  { href: '/manage/schemes', label: 'Customize schemes', icon: Leaf },
  { href: '/workspace', label: 'Operations workspace', icon: ClipboardList },
];
const primary = 'inline-flex items-center justify-center gap-2 rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-emerald hover:border-leaf disabled:cursor-not-allowed disabled:opacity-45';

function SchemeShell({ children }: { children: ReactNode }) {
  const me = useGetMe();
  return <AppShell nav={nav} zone="Scheme management">
    {me.isLoading ? <Skeleton className="h-64" /> : !me.data?.roles.some(role => ['administrator', 'super-administrator'].includes(role))
      ? <EmptyState icon={<Lock className="h-6 w-6" />} title="Administrator access required" body="Scheme customization is available to authorized administrators." />
      : children}
  </AppShell>;
}
export function SchemesPage() {
  useSeo('Customize schemes', 'Configure harvest benefits, prices and agreement terms.');
  return <SchemeShell><SchemeList /></SchemeShell>;
}
function SchemeList() {
  const query = useListManagedSchemes(), create = useCreateManagedScheme(), cache = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('draft');
  async function duplicate(scheme: ManagedScheme) {
    try {
      const result = await create.mutateAsync({ data: { name: `${scheme.name.slice(0, 190)} · Copy`, configuration: scheme.configuration } });
      await cache.invalidateQueries({ queryKey: getListManagedSchemesQueryKey() });
      navigate(`/manage/schemes/${result.id}`);
    } catch { /* Mutation error is rendered below. */ }
  }
  const items = query.data?.filter(s => (filter === 'all' || s.status === filter) && `${s.name} ${s.configuration.species}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <>
    <AppHeading eyebrow="Your harvest offers" title="Customize schemes"><Link href="/manage/schemes/new" className={primary} data-testid="button-create-scheme"><Plus className="h-4 w-4" />New scheme</Link></AppHeading>
    <p className="-mt-4 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">Set your harvest benefits, pricing and fulfilment terms. Save drafts, review the purchase experience and keep a record of every revision.</p>
    <div className="mb-6 flex flex-col gap-3 sm:flex-row"><Input aria-label="Search schemes" placeholder="Search name or species" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Scheme status" className="h-10 rounded-md border border-input bg-card px-3 text-sm" value={filter} onChange={e => setFilter(e.target.value)}><option value="draft">Draft schemes</option><option value="archived">Archived schemes</option><option value="all">All schemes</option></select></div>
    {create.isError && <p role="alert" className="mb-4 text-sm text-destructive">{errorMessage(create.error)}</p>}
    {query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} /> : query.isLoading ? <Skeleton className="h-64 rounded-2xl" /> : !items.length ? <EmptyState icon={<Leaf className="h-6 w-6" />} title="No schemes found" body="Create a scheme or change your search and status filter." /> : <div className="grid gap-4 xl:grid-cols-2">{items.map(s => <article key={s.id} className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3"><div><StatusPill status={s.status} /><h2 className="mt-3 font-display text-2xl text-emerald">{s.name}</h2></div><p className="whitespace-nowrap text-lg font-semibold text-harvest">{formatPaise(s.configuration.feePaise)}</p></div>
      <p className="mt-2 text-sm text-muted-foreground">{s.configuration.species} · {s.configuration.durationMonths} months · {humanize(s.configuration.allocationType)}</p>
      <p className="mt-2 line-clamp-2 text-sm">{s.configuration.description || 'Add a short description in the editor.'}</p>
      <p className="mt-4 font-mono text-xs text-muted-foreground">Version {s.version} · Updated {formatDate(s.updatedAt)}</p>
      <div className="mt-5 flex flex-wrap gap-2"><Link href={`/manage/schemes/${s.id}`} className={primary} data-testid={`edit-scheme-${s.id}`}>Edit scheme <ArrowRight className="h-4 w-4" /></Link><Link href={`/manage/schemes/${s.id}/checkout-preview`} className={secondary}><Eye className="h-4 w-4" />Preview</Link><button type="button" onClick={() => duplicate(s)} disabled={create.isPending} className={secondary} aria-label={`Copy ${s.name}`}><Copy className="h-4 w-4" />Copy</button></div>
    </article>)}</div>}
    <p className="mt-7 text-xs text-muted-foreground">Draft schemes are not published offers. Tree verification, scheme approval and a connected payment gateway are required before purchase.</p>
  </>;
}

export function SchemeEditorPage() {
  const { id = '' } = useParams<{ id: string }>();
  useSeo('Edit scheme', 'Customize your harvest scheme and save versioned changes.');
  return <SchemeShell><LoadEditor key={id} id={id} /></SchemeShell>;
}
function LoadEditor({ id }: { id: string }) {
  const query = useGetManagedScheme(id, { query: { enabled: id !== 'new' && !!id, queryKey: getGetManagedSchemeQueryKey(id) } });
  if (id === 'new') return <SchemeEditor />;
  if (query.isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (query.isError || !query.data) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  return <SchemeEditor initial={query.data} />;
}
function SchemeEditor({ initial }: { initial?: ManagedScheme }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<SchemeEditorInput>(() => initial ? { name: initial.name, configuration: initial.configuration } : { name: '', configuration: newConfiguration() });
  const [reason, setReason] = useState('Updated scheme configuration'), [message, setMessage] = useState('');
  const create = useCreateManagedScheme(), update = useUpdateManagedScheme(), cache = useQueryClient();
  const revisions = useListSchemeRevisions(saved?.id ?? '', { query: { enabled: !!saved?.id } });
  const [, navigate] = useLocation();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ? { name: saved.name, configuration: saved.configuration } : { name: '', configuration: newConfiguration() });
  const busy = create.isPending || update.isPending, archived = saved?.status === 'archived';
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const leave = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.('a[href]');
      if (link && !event.defaultPrevented && !window.confirm('Leave without saving your scheme changes?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', leave, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', leave, true); };
  }, [dirty]);
  async function save(status: 'draft' | 'archived' = 'draft') {
    setMessage('');
    try {
      const result = saved ? await update.mutateAsync({ schemeId: saved.id, data: { ...draft, version: saved.version, status, reason: status !== saved.status ? `${status === 'archived' ? 'Archived' : 'Restored'} scheme configuration` : reason } })
        : await create.mutateAsync({ data: draft });
      setSaved(result); setDraft({ name: result.name, configuration: result.configuration }); setMessage(`Saved version ${result.version}.`);
      cache.setQueryData(getGetManagedSchemeQueryKey(result.id), result);
      await Promise.all([cache.invalidateQueries({ queryKey: getListManagedSchemesQueryKey() }), cache.invalidateQueries({ queryKey: getListSchemeRevisionsQueryKey(result.id) }), cache.invalidateQueries({ queryKey: ['/api/v1/workspace/summary'] })]);
      if (!saved) navigate(`/manage/schemes/${result.id}`);
    } catch { /* Errors remain beside the save action. */ }
  }
  async function reload() {
    if (dirty && !window.confirm('Discard local changes and load the latest saved version?')) return;
    if (!saved) return;
    try {
      const latest = await getManagedScheme(saved.id);
      cache.setQueryData(getGetManagedSchemeQueryKey(saved.id), latest);
      setSaved(latest); setDraft({ name: latest.name, configuration: latest.configuration }); update.reset(); setMessage('Loaded the latest saved version.');
    } catch (error) { setMessage(`Could not reload: ${errorMessage(error)}`); }
  }
  return <>
    <Link href="/manage/schemes" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />All schemes</Link>
    <AppHeading eyebrow={saved ? `Version ${saved.version} · ${saved.status}` : 'New scheme'} title={saved?.name ?? 'Create your scheme'}>{saved && <Link href={`/manage/schemes/${saved.id}/checkout-preview`} className={secondary}><Eye className="h-4 w-4" />Preview saved scheme</Link>}</AppHeading>
    {archived && <p className="mb-5 rounded-xl bg-secondary p-4 text-sm">This scheme is archived. Restore it to make changes.</p>}
    {initial && saved && initial.version !== saved.version && <div className="mb-4 rounded-xl border border-harvest p-4 text-sm">A different saved version is available. <button type="button" className="font-semibold underline" onClick={reload}>Load latest</button></div>}
    <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-5">
      <label className="block space-y-2 rounded-2xl border border-border bg-card p-5 text-sm font-medium" htmlFor="scheme-name"><span>Scheme name</span><Input id="scheme-name" required minLength={2} maxLength={200} value={draft.name} disabled={busy || archived} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <SchemeFields value={draft.configuration} onChange={configuration => setDraft({ ...draft, configuration })} disabled={busy || archived} />
      {saved && !archived && <label htmlFor="scheme-reason" className="block space-y-2 text-sm font-medium"><span>Reason for this revision</span><Input id="scheme-reason" required minLength={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>}
      {(create.isError || update.isError) && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{errorMessage(create.error || update.error)}{saved && <button type="button" className="ml-2 underline" onClick={reload}>Reload saved version</button>}</div>}
      {message && <p role="status" className="text-sm font-medium text-leaf">{message}</p>}
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        {!archived && <button className={primary} disabled={busy} type="submit" data-testid="button-save-scheme"><Save className="h-4 w-4" />{busy ? 'Saving…' : 'Save scheme'}</button>}
        {saved && <button className={secondary} type="button" disabled={busy || dirty} onClick={() => void save(archived ? 'draft' : 'archived')}>{archived ? 'Restore scheme' : 'Archive scheme'}</button>}
        <span className="text-xs text-muted-foreground">{dirty ? 'Unsaved changes · save before archiving or previewing changes' : 'Saved configuration · payments unavailable'}</span>
      </div>
    </form>
    {saved && <section className="mt-10"><h2 className="font-display text-2xl text-emerald">Revision history</h2>{revisions.isLoading ? <Skeleton className="mt-4 h-24" /> : revisions.isError ? <ErrorState message={errorMessage(revisions.error)} onRetry={() => revisions.refetch()} /> : <div className="mt-4 space-y-2">{revisions.data?.map(r => <details key={r.version} className="rounded-xl border border-border bg-card p-4"><summary className="cursor-pointer text-sm font-medium">Version {r.version} · {r.status} · {formatDate(r.recordedAt)} · {r.reason}</summary><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Name</dt><dd>{r.name}</dd></div>{Object.entries(r.configuration).map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-xs text-muted-foreground">{humanize(key.replace(/([A-Z])/g, ' $1'))}</dt><dd className="whitespace-pre-wrap break-words">{Array.isArray(value) ? value.join(', ') || '—' : value === null || value === '' ? '—' : String(value)}</dd></div>)}</dl></details>)}</div>}</section>}
  </>;
}

export function SchemeCheckoutPreviewPage() {
  useSeo('Scheme checkout preview', 'Review the saved adoption price and harvest terms.');
  const { id = '' } = useParams<{ id: string }>();
  return <SchemeShell><CheckoutPreview id={id} /></SchemeShell>;
}
function CheckoutPreview({ id }: { id: string }) {
  const query = useGetManagedScheme(id), [method, setMethod] = useState('');
  if (query.isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (query.isError || !query.data) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  const scheme = query.data, c = scheme.configuration;
  const selected = c.fulfilmentMethods.find(m => m === method) ?? c.fulfilmentMethods[0];
  const tax = Math.round(c.feePaise * c.taxBps / 10000), delivery = selected === 'delivery' ? c.deliveryFeePaise : 0;
  const benefit = c.allocationType === 'fixed-quantity' ? `${c.quantity} ${c.unit} across ${c.durationMonths} months` : c.allocationType === 'exclusive-harvest' ? 'Full harvest of the assigned tree' : `${c.sharePercent}% of eligible harvest${c.allocationType === 'sale-proceeds' ? ' sale proceeds' : ''}`;
  return <>
    <Link href={`/manage/schemes/${id}`} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Back to scheme</Link>
    <AppHeading eyebrow={`Administrator preview · saved version ${scheme.version}`} title="Your tree. Your harvest." />
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6 rounded-2xl border border-border bg-card p-6"><div><StatusPill status={scheme.status} /><h2 className="mt-3 font-display text-3xl text-emerald">{scheme.name}</h2><p className="mt-2 text-sm text-muted-foreground">{c.description}</p></div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">{[['Your benefit', benefit], ['Species', `${c.species}${c.variety ? ` · ${c.variety}` : ''}`], ['Duration', `${c.durationMonths} months`], ['Season', c.season || 'To be specified']].map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="mt-1 font-medium">{v}</dd></div>)}</dl>
        <fieldset><legend className="mb-3 text-sm font-semibold">How would you like your harvest?</legend><div className="space-y-2">{c.fulfilmentMethods.map(m => <label key={m} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4 text-sm"><input type="radio" name="fulfilment" className="accent-emerald" value={m} checked={selected === m} onChange={() => setMethod(m)} />{m === 'sale-settlement' ? 'Sell the harvest & settle the proceeds' : m === 'delivery' ? 'Deliver my harvest' : 'Collect from the farm'}</label>)}</div></fieldset>
        {selected === 'sale-settlement' && <p className="rounded-xl bg-secondary p-4 text-sm">This price is the initial adoption fee. Later harvest-sale proceeds depend on actual yield, sales and the scheme’s deductions. They are not a guaranteed return.</p>}
        {selected === 'delivery' && <p className="text-sm text-muted-foreground">Delivery regions: {c.deliveryRegions || 'Not configured'}. {c.fulfilmentPolicy}</p>}
        {([['Benefits & exclusions', [c.inclusions, c.exclusions].filter(Boolean).join('\n')], ['Risks & harvest shortfall', [c.risks, c.lossRules, c.shortfallPolicy].filter(Boolean).join('\n')], ['Cancellation & agreement', [c.cancellationPolicy, c.renewalPolicy, c.terms].filter(Boolean).join('\n')], ['Fulfilment & settlement', c.fulfilmentPolicy]] as const).map(([title, content]) => <details key={title} className="border-t border-border pt-4"><summary className="cursor-pointer text-sm font-semibold">{title}</summary><p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{content || 'Terms must be configured and approved before this scheme can be purchased.'}</p></details>)}
      </section>
      <aside className="rounded-2xl bg-emerald p-6 text-ivory"><p className="eyebrow text-ivory/65">Purchase review</p><h2 className="mt-3 font-display text-2xl">One clear total.</h2><dl className="mt-6 space-y-3 text-sm">{[['Adoption fee', c.feePaise], [`Tax on fee (${c.taxBps / 100}%)`, tax], ['Delivery · tax inclusive', delivery]].map(([label, amount]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd>{formatPaise(Number(amount))}</dd></div>)}<div className="flex justify-between gap-3 border-t border-ivory/20 pt-4 text-xl font-semibold"><dt>Total</dt><dd>{formatPaise(c.feePaise + tax + delivery)}</dd></div></dl>
        <button type="button" disabled className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-ivory/20 px-4 py-3 font-semibold text-ivory/70"><Lock className="h-4 w-4" />Payment unavailable</button>
        <p className="mt-4 text-xs leading-relaxed text-ivory/75">Private preview only. No order or payment is created. Farm and tree verification, scheme approval and a connected payment gateway are required before checkout can open.</p>
      </aside>
    </div>
  </>;
}
