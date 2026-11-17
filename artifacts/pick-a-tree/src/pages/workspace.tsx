import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList, FileClock, LayoutGrid, Lock, Pencil, Plus, Search, Tractor } from 'lucide-react';
import { useGetWorkspaceSummary, useListRecords, useListWorkspaceModules, type Module, type PlatformRecord } from '@workspace/api-client-react';
import { AppHeading, AppShell, type NavItem } from '@/components/app-shell';
import { EmptyState, ErrorState, StatusPill } from '@/components/site/bits';
import { RecordFields, RecordFormDialog, RecordRow, TransitionDialog } from '@/components/records';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { errorMessage, errorStatus, formatDate, humanize, useSeo } from '@/lib/brand';

function Overview({ modules }: { modules: Module[] }) {
  const { data, isLoading, isError, error, refetch } = useGetWorkspaceSummary();
  return (
    <>
      <AppHeading eyebrow="Operations workspace" title="Today on the farms" />
      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {isLoading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : data?.counts.map((c) => (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-5" data-testid={`text-count-${c.label}`}>
              <p className="font-display text-5xl font-light text-emerald">{c.value}</p><p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-12 grid gap-10 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-4 font-display text-2xl text-emerald">Modules you can access</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((m) => (
              <Link key={m.key} href={`/workspace/${m.key}`} className="rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-leaf" data-testid={`link-module-${m.key}`}>
                <p className="font-semibold text-emerald">{m.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
              </Link>
            ))}
          </div>
        </section>
        <section className="lg:col-span-2">
          <h2 className="mb-4 font-display text-2xl text-emerald">Recent activity</h2>
          {isLoading ? <Skeleton className="h-40" /> : data && data.recent.length > 0 ? <div className="space-y-2">{data.recent.map((r) => <RecordRow key={r.id} record={r} />)}</div> : (
            <EmptyState icon={<FileClock className="h-6 w-6" />} title="No records yet." body="Activity appears as staff register farms, trees and tasks." />
          )}
        </section>
      </div>
    </>
  );
}

function ModuleView({ mod }: { mod: Module }) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<PlatformRecord | null>(null);
  const [editing, setEditing] = useState<PlatformRecord | null>(null);
  const [transition, setTransition] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => { setSearch(text.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [text]);
  const params = { page, ...(search ? { search } : {}), ...(status !== 'all' ? { status } : {}) };
  const { data, isLoading, isError, error, refetch } = useListRecords(mod.key, params);
  useEffect(() => {
    if (selected && data) { const fresh = data.items.find((r) => r.id === selected.id); if (fresh && fresh.version !== selected.version) setSelected(fresh); }
  }, [data, selected]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <Link href="/workspace" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald" data-testid="link-workspace-back"><ArrowLeft className="h-4 w-4" />Overview</Link>
      <AppHeading eyebrow="Module" title={mod.title}>
        {mod.canCreate && <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-full bg-harvest px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="button-new-record"><Plus className="h-4 w-4" />New draft</button>}
      </AppHeading>
      <p className="-mt-6 mb-8 max-w-2xl text-muted-foreground">{mod.description}</p>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search titles" className="bg-card pl-9" data-testid="input-search-records" /></div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="bg-card sm:w-52" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{mod.statuses.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div> : data && data.items.length > 0 ? (
        <>
          <div className="space-y-2">{data.items.map((r) => <RecordRow key={r.id} record={r} onOpen={() => setSelected(r)} />)}</div>
          <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
            <span data-testid="text-records-total">{data.total} records</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-border p-2 disabled:opacity-40" aria-label="Previous" data-testid="button-prev-page"><ChevronLeft className="h-4 w-4" /></button>
              <span>{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-border p-2 disabled:opacity-40" aria-label="Next" data-testid="button-next-page"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title={search || status !== 'all' ? 'No matching records.' : `No ${mod.title.toLowerCase()} yet.`}
          body={mod.canCreate ? 'Start with a draft. Approvals and state changes are recorded with reasons.' : 'Your role can view this module but not create records here.'} />
      )}

      {creating && <RecordFormDialog module={mod} open={creating} onOpenChange={setCreating} />}
      {editing && <RecordFormDialog key={editing.id + editing.version} module={mod} record={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />}
      {selected && <TransitionDialog moduleKey={mod.key} record={selected} to={transition} onClose={() => setTransition(null)} />}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (<>
            <SheetHeader><SheetTitle className="pr-6 font-display text-2xl font-normal text-emerald">{selected.title}</SheetTitle></SheetHeader>
            <div className="mt-2 flex flex-wrap items-center gap-3"><StatusPill status={selected.status} /><span className="font-mono text-xs text-muted-foreground">v{selected.version} · {formatDate(selected.createdAt)}</span></div>
            <div className="mt-6 rounded-2xl border border-border bg-card p-5"><RecordFields record={selected} fields={mod.fields} /></div>
            {(selected.farmId || selected.treeId) && <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">{selected.farmId && `Farm ${selected.farmId}`} {selected.treeId && `· Tree ${selected.treeId}`}</p>}
            <div className="mt-6">
              <p className="eyebrow mb-3 text-muted-foreground">Next steps allowed</p>
              {selected.allowedTransitions && selected.allowedTransitions.length > 0 ? (
                <div className="flex flex-wrap gap-2">{selected.allowedTransitions.map((t) => (
                  <button key={t} type="button" onClick={() => setTransition(t)} className="rounded-full border border-emerald px-4 py-2 text-sm font-medium text-emerald hover:bg-emerald hover:text-ivory" data-testid={`button-transition-${t}`}>{humanize(t)}</button>
                ))}</div>
              ) : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" />No transitions available to your role, or this step is gated on a later milestone.</p>}
            </div>
            <button type="button" onClick={() => setEditing(selected)} className="mt-6 inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-emerald" data-testid="button-edit-record"><Pencil className="h-4 w-4" />Edit details</button>
          </>)}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function WorkspacePage() {
  const { module: key } = useParams<{ module?: string }>();
  const { data: modules, isLoading, isError, error, refetch } = useListWorkspaceModules();
  useSeo('Operations workspace', 'Staff workspace for farms, trees, tasks, harvest and support records.');
  const nav: NavItem[] = [{ href: '/workspace', label: 'Overview', icon: LayoutGrid }, { href: '/manage/farms', label: 'Manage farms', icon: Tractor }, ...(modules ?? []).map((m) => ({ href: m.key === 'schemes' ? '/manage/schemes' : `/workspace/${m.key}`, label: m.key === 'schemes' ? 'Customize schemes' : m.title, icon: ClipboardList }))];
  const mod = modules?.find((m) => m.key === key);
  let body;
  if (isError) body = errorStatus(error) === 403 ? <EmptyState icon={<Lock className="h-6 w-6" />} title="Staff access required." body="Your account does not have an operations role. Roles are granted by a verified administrator." /> : <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  else if (isLoading) body = <Skeleton className="h-96" />;
  else if (!key) body = <Overview modules={modules ?? []} />;
  else if (!mod) body = <EmptyState icon={<Lock className="h-6 w-6" />} title="Module unavailable." body="It does not exist or your role cannot access it." />;
  else body = <ModuleView key={mod.key} mod={mod} />;
  return <AppShell nav={nav} zone="Operations" footerLink={<Link href="/portal" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-harvest hover:bg-sidebar-accent" data-testid="link-to-portal">Customer portal</Link>}>{body}</AppShell>;
}
