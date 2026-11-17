import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Briefcase, Home, LifeBuoy, Loader2, Package, Plus, ShieldCheck, Sprout, TreeDeciduous, User, Wheat } from 'lucide-react';
import {
  getGetMeQueryKey, useGetCustomerDashboard, useGetMe, useListRecords, useListWorkspaceModules, useUpdateProfile,
  type PlatformRecord, type ProfileInput,
} from '@workspace/api-client-react';
import { AppHeading, AppShell, type NavItem } from '@/components/app-shell';
import { EmptyState, ErrorState, AvailabilityNote } from '@/components/site/bits';
import { RecordFields, RecordFormDialog, RecordRow } from '@/components/records';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, useSeo } from '@/lib/brand';
import { canManageFarms } from '@/lib/manage';
import NotFound from '@/pages/not-found';

const NAV: NavItem[] = [
  { href: '/portal', label: 'Overview', icon: Home },
  { href: '/portal/trees', label: 'My Trees', icon: TreeDeciduous },
  { href: '/portal/adoptions', label: 'Adoptions', icon: Sprout },
  { href: '/portal/harvest', label: 'Harvest', icon: Wheat },
  { href: '/portal/orders', label: 'Orders', icon: Package },
  { href: '/portal/notifications', label: 'Notifications', icon: Bell },
  { href: '/portal/support', label: 'Support', icon: LifeBuoy },
  { href: '/portal/profile', label: 'Profile', icon: User },
];

const STAFF_ROLES = ['administrator', 'super-administrator', 'farm-manager', 'farm-worker', 'agronomist', 'harvest-operator', 'support', 'finance', 'content-manager'];

function RecordList({ items, empty, onOpen }: { items: PlatformRecord[]; empty: { title: string; body: string }; onOpen: (r: PlatformRecord) => void }) {
  if (items.length === 0) return <EmptyState icon={<Sprout className="h-6 w-6" />} title={empty.title} body={empty.body} />;
  return <div className="space-y-2">{items.map((r) => <RecordRow key={r.id} record={r} onOpen={() => onOpen(r)} />)}</div>;
}

function RecordSheet({ record, onClose }: { record: PlatformRecord | null; onClose: () => void }) {
  return (
    <Sheet open={!!record} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {record && (<>
          <SheetHeader><SheetTitle className="font-display text-2xl font-normal text-emerald">{record.title}</SheetTitle></SheetHeader>
          <p className="mt-1 font-mono text-xs text-muted-foreground">Status {record.status} · version {record.version}</p>
          <div className="mt-6"><RecordFields record={record} /></div>
        </>)}
      </SheetContent>
    </Sheet>
  );
}

function Overview({ name }: { name: string }) {
  const { data, isLoading, isError, error, refetch } = useGetCustomerDashboard();
  const { data: me } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const [open, setOpen] = useState<PlatformRecord | null>(null);
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const tiles = [
    ['My Trees', data?.adoptions.length, '/portal/trees'], ['Harvest records', data?.harvests.length, '/portal/harvest'],
    ['Orders', data?.orders.length, '/portal/orders'], ['Open cases', data?.tickets.length, '/portal/support'],
  ] as const;
  return (
    <>
      <AppHeading eyebrow="Your portal" title={<>Vanakkam, <em className="text-harvest">{name}</em>.</>} />
      {me && canManageFarms(me.roles) && <div className="mb-8"><AvailabilityNote><Link href="/manage/farms" className="font-semibold underline underline-offset-4" data-testid="link-portal-manage">Manage farms, trees and photos</Link>{me.roles.some(role => ['administrator', 'super-administrator'].includes(role)) && <><span className="mx-3">·</span><Link href="/manage/schemes" className="font-semibold underline underline-offset-4" data-testid="link-portal-schemes">Customize schemes</Link></>}</AvailabilityNote></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([label, n, href]) => (
          <Link key={label} href={href} className="rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-leaf" data-testid={`link-tile-${label.toLowerCase().replace(/\s/g, '-')}`}>
            {isLoading ? <Skeleton className="h-10 w-12" /> : <p className="font-display text-5xl font-light text-emerald">{n ?? 0}</p>}
            <p className="mt-2 text-sm text-muted-foreground">{label}</p>
          </Link>
        ))}
      </div>
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section><h2 className="mb-4 font-display text-2xl text-emerald">Latest notifications</h2>
          {isLoading ? <Skeleton className="h-32" /> : <RecordList items={data?.notifications.slice(0, 5) ?? []} onOpen={setOpen} empty={{ title: 'All quiet.', body: 'Updates about your tree, harvest and cases will appear here.' }} />}</section>
        <section><h2 className="mb-4 font-display text-2xl text-emerald">Your trees</h2>
          {isLoading ? <Skeleton className="h-32" /> : data && data.adoptions.length > 0 ? <RecordList items={data.adoptions.slice(0, 5)} onOpen={setOpen} empty={{ title: '', body: '' }} /> : (
            <EmptyState icon={<TreeDeciduous className="h-6 w-6" />} title="No tree yet." body="Verified trees will appear in the catalogue once inspected and approved.">
              <Link href="/adopt" className="rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="link-browse">Browse catalogue</Link>
            </EmptyState>
          )}</section>
      </div>
      <RecordSheet record={open} onClose={() => setOpen(null)} />
    </>
  );
}

function DashboardList({ section }: { section: 'trees' | 'adoptions' | 'harvest' | 'orders' | 'notifications' }) {
  const { data, isLoading, isError, error, refetch } = useGetCustomerDashboard();
  const [open, setOpen] = useState<PlatformRecord | null>(null);
  const cfg = {
    trees: { t: 'My Trees', items: data?.adoptions, e: { title: 'No adopted trees yet.', body: 'When an adoption becomes active, its Tree Passport opens here.' } },
    adoptions: { t: 'Adoptions & agreements', items: data?.adoptions, e: { title: 'No adoptions yet.', body: 'Reservations, agreements and receipts will be listed here once adoptions open.' } },
    harvest: { t: 'Harvest', items: data?.harvests, e: { title: 'No harvest records.', body: 'Measured and verified allocations from your tree will appear here, season by season.' } },
    orders: { t: 'Orders', items: data?.orders, e: { title: 'No orders.', body: 'Payments and Nourish orders are not live yet. Nothing here can be charged.' } },
    notifications: { t: 'Notifications', items: data?.notifications, e: { title: 'No notifications.', body: 'Messages about your account and trees will appear here first.' } },
  }[section];
  return (
    <>
      <AppHeading eyebrow="Portal" title={cfg.t} />
      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> : <RecordList items={cfg.items ?? []} empty={cfg.e} onOpen={setOpen} />}
      <RecordSheet record={open} onClose={() => setOpen(null)} />
    </>
  );
}

function CustomerModule({ moduleKey, title, cta, eyebrow }: { moduleKey: 'tickets' | 'privacy-requests'; title: string; cta: string; eyebrow: string }) {
  const { data: modules, isLoading: ml } = useListWorkspaceModules();
  const mod = modules?.find((m) => m.key === moduleKey);
  const { data: page, isLoading, isError, error, refetch } = useListRecords(moduleKey);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<PlatformRecord | null>(null);
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div><p className="eyebrow text-leaf">{eyebrow}</p><h2 className="mt-2 font-display text-3xl text-emerald">{title}</h2></div>
        {mod?.canCreate && <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-full bg-harvest px-5 py-2.5 text-sm font-semibold text-ivory" data-testid={`button-new-${moduleKey}`}><Plus className="h-4 w-4" />{cta}</button>}
      </div>
      {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading || ml ? <Skeleton className="h-24" /> : (
        <RecordList items={page?.items ?? []} onOpen={setOpen} empty={{ title: 'Nothing here yet.', body: 'Requests you submit are listed here with their status.' }} />
      )}
      {mod && creating && <RecordFormDialog module={mod} open={creating} onOpenChange={setCreating} titleLabel="Subject" />}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && (<><SheetHeader><SheetTitle className="font-display text-2xl font-normal text-emerald">{open.title}</SheetTitle></SheetHeader>
            <p className="mt-1 font-mono text-xs text-muted-foreground">Status {open.status}</p>
            <div className="mt-6"><RecordFields record={open} fields={mod?.fields} /></div></>)}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Profile() {
  const { data: me, isLoading, isError, error, refetch } = useGetMe();
  const update = useUpdateProfile();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<ProfileInput>({});
  const init = useRef<string | null>(null);
  useEffect(() => {
    if (me && init.current !== me.id) {
      init.current = me.id;
      setForm({ displayName: me.profile.displayName ?? me.displayName, phone: me.profile.phone ?? '', address: me.profile.address ?? '', language: me.profile.language ?? 'en',
        emailNotifications: me.profile.emailNotifications ?? true, smsNotifications: me.profile.smsNotifications ?? false, whatsappNotifications: me.profile.whatsappNotifications ?? false });
    }
  }, [me]);
  const save = () => update.mutate({ data: form }, {
    onSuccess: (u) => { qc.setQueryData(getGetMeQueryKey(), u); toast({ title: 'Profile saved' }); },
    onError: (e) => toast({ title: 'Could not save', description: errorMessage(e), variant: 'destructive' }),
  });
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  if (isLoading) return <Skeleton className="h-96" />;
  const toggles: [keyof ProfileInput, string][] = [['emailNotifications', 'Email updates'], ['smsNotifications', 'SMS updates'], ['whatsappNotifications', 'WhatsApp updates']];
  return (
    <>
      <AppHeading eyebrow="Account" title="Profile & preferences" />
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-5 rounded-[1.5rem] border border-border bg-card p-6 lg:col-span-3">
          <div className="space-y-1.5"><Label htmlFor="p-name">Display name</Label><Input id="p-name" value={form.displayName ?? ''} onChange={(e) => setForm({ ...form, displayName: e.target.value })} data-testid="input-display-name" /></div>
          <div className="space-y-1.5"><Label htmlFor="p-phone">Mobile</Label><Input id="p-phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-profile-phone" /></div>
          <div className="space-y-1.5"><Label htmlFor="p-address">Delivery address</Label><Textarea id="p-address" rows={3} value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="input-address" /></div>
          <div className="space-y-1.5"><Label>Language</Label>
            <Select value={form.language ?? 'en'} onValueChange={(v) => setForm({ ...form, language: v as 'en' | 'ta' })}><SelectTrigger data-testid="select-profile-language"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ta">தமிழ் (Tamil)</SelectItem></SelectContent></Select></div>
          <div className="space-y-2">{toggles.map(([k, l]) => (
            <div key={k} className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3"><span className="text-sm">{l}</span>
              <Switch checked={form[k] === true} onCheckedChange={(v) => setForm({ ...form, [k]: v })} data-testid={`switch-${k}`} /></div>))}
            <p className="text-xs text-muted-foreground">Preferences are stored now; SMS and WhatsApp delivery activates only after provider approval.</p></div>
          <button type="button" onClick={save} disabled={update.isPending} className="inline-flex items-center gap-2 rounded-full bg-emerald px-6 py-3 text-sm font-semibold text-ivory disabled:opacity-60" data-testid="button-save-profile">
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save profile</button>
        </div>
        <div className="lg:col-span-2"><CustomerModule moduleKey="privacy-requests" title="Privacy requests" cta="New request" eyebrow="Your data" /></div>
      </div>
    </>
  );
}

export default function PortalPage() {
  const { section } = useParams<{ section?: string }>();
  const { data: me } = useGetMe();
  useSeo('My portal', 'Your Pick My Tree trees, harvests, orders, notifications and support.');
  const isStaff = !!me?.roles.some((r) => STAFF_ROLES.includes(r));
  const name = me?.profile.displayName || me?.displayName || 'friend';
  let body;
  switch (section) {
    case undefined: body = <Overview name={name} />; break;
    case 'trees': case 'adoptions': case 'harvest': case 'orders': case 'notifications': body = <DashboardList section={section} />; break;
    case 'support': body = <><AppHeading eyebrow="Help" title="Support" /><CustomerModule moduleKey="tickets" title="Your cases" cta="Open a case" eyebrow="Talk to us" /></>; break;
    case 'profile': body = <Profile />; break;
    default: return <NotFound />;
  }
  return (
    <AppShell nav={NAV} zone="Customer portal" footerLink={isStaff ? <Link href="/workspace" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-harvest hover:bg-sidebar-accent" data-testid="link-workspace"><Briefcase className="h-4 w-4" />Operations workspace</Link> : <span className="flex items-center gap-2 px-3 text-xs text-sidebar-foreground/50"><ShieldCheck className="h-3.5 w-3.5" />Private to you</span>}>
      {body}
    </AppShell>
  );
}
