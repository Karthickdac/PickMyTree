import { useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardList, CreditCard, KeyRound, Leaf, Loader2, Lock, ShieldCheck, Tractor } from 'lucide-react';
import {
  getGetAdoptionReadinessQueryKey, getListManagedSchemesQueryKey, useGetAdoptionReadiness, useGetMe, useRecordAdoptionApproval,
  type AdoptionReadiness, type ApprovalReadinessItem,
} from '@workspace/api-client-react';
import { AppHeading, AppShell, type NavItem } from '@/components/app-shell';
import { EmptyState, ErrorState } from '@/components/site/bits';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { errorMessage, errorStatus, useSeo } from '@/lib/brand';
import { invalidateCatalogue } from '@/lib/manage';
import { cn } from '@/lib/utils';

const nav: NavItem[] = [
  { href: '/manage/farms', label: 'Farms & trees', icon: Tractor },
  { href: '/manage/schemes', label: 'Customize schemes', icon: Leaf },
  { href: '/manage/adoption-readiness', label: 'Adoption readiness', icon: ShieldCheck },
  { href: '/workspace', label: 'Operations workspace', icon: ClipboardList },
];
const KIND_LABEL = { farms: 'Farms', trees: 'Trees', schemes: 'Schemes' } as const;
const stepUpHref = `/api/auth/step-up?returnTo=${encodeURIComponent('/manage/adoption-readiness')}`;

export default function AdoptionReadinessPage() {
  useSeo('Adoption readiness', 'Administrator approval of farms, trees and schemes before adoption opens.');
  const me = useGetMe();
  const admin = !!me.data?.roles.some(r => ['administrator', 'super-administrator'].includes(r));
  return <AppShell nav={nav} zone="Adoption readiness">
    {me.isLoading ? <Skeleton className="h-64" /> : !admin
      ? <EmptyState icon={<Lock className="h-6 w-6" />} title="Global administrator access required" body="Approving farms, trees and schemes for adoption is limited to global administrators." />
      : <Readiness superAdmin={!!me.data?.roles.includes('super-administrator')} />}
  </AppShell>;
}

function Readiness({ superAdmin }: { superAdmin: boolean }) {
  const q = useGetAdoptionReadiness();
  const [kind, setKind] = useState<'all' | 'farms' | 'trees' | 'schemes'>('all');
  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-28" /><Skeleton className="h-40" /></div>;
  if (q.isError || !q.data) return <ErrorState message={errorStatus(q.error) === 403 ? 'Your account cannot open adoption approvals.' : errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const d = q.data;
  const items = d.items.filter(i => kind === 'all' || i.kind === kind);
  return <>
    <AppHeading eyebrow="Before anyone can adopt" title="Adoption readiness" />
    <p className="-mt-4 mb-7 max-w-2xl text-sm leading-relaxed text-muted-foreground">A tree opens for adoption only when its farm, the tree itself and at least one scheme are approved here and payments are accepted. Each approval records your name, the exact version reviewed and your evidence reference.</p>
    <div className="mb-8 grid gap-3 md:grid-cols-2">
      <StatusCard ok={d.recentMfa} icon={<KeyRound className="h-5 w-5" />} title={d.recentMfa ? 'Second factor confirmed recently' : 'Second-factor sign-in needed'}>
        {d.recentMfa ? 'You can record approvals and revocations in this session.' : <>Approvals need a recent managed second-factor sign-in. <a href={stepUpHref} className="font-semibold underline underline-offset-4" data-testid="link-step-up">Confirm second factor</a>. If managed sign-in is not configured, the server will say so explicitly.</>}
      </StatusCard>
      <PaymentCard payment={d.payment} />
    </div>
    <div className="mb-5 flex gap-2 overflow-x-auto">
      {(['all', 'farms', 'trees', 'schemes'] as const).map(k => {
        const n = k === 'all' ? d.items.length : d.items.filter(i => i.kind === k).length;
        return <button key={k} type="button" onClick={() => setKind(k)} data-testid={`button-kind-${k}`} className={cn('shrink-0 rounded-full px-4 py-2 text-sm font-medium', kind === k ? 'bg-emerald text-ivory' : 'bg-card text-foreground/75 hover:bg-secondary')}>{k === 'all' ? 'All' : KIND_LABEL[k]} <span className="font-mono text-xs opacity-70">{n}</span></button>;
      })}
    </div>
    {items.length === 0 ? <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Nothing to review" body="Farms, trees and schemes appear here once they are created in management." />
      : <div className="space-y-3">{items.map(i => <ItemRow key={`${i.kind}-${i.id}`} item={i} canApprove={d.recentMfa} superAdmin={superAdmin} />)}</div>}
  </>;
}

function StatusCard({ ok, icon, title, children }: { ok: boolean; icon: ReactNode; title: string; children: ReactNode }) {
  return <div className={cn('flex gap-3 rounded-2xl border p-5', ok ? 'border-leaf/40 bg-secondary/60' : 'border-harvest/40 bg-harvest/8')}>
    <span className={cn('mt-0.5', ok ? 'text-leaf' : 'text-harvest')}>{icon}</span>
    <div><p className="font-semibold text-emerald">{title}</p><p className="mt-1 text-sm text-foreground/75">{children}</p></div>
  </div>;
}

function PaymentCard({ payment }: { payment: AdoptionReadiness['payment'] }) {
  const text = !payment.configured || payment.mode === 'unconfigured' ? 'No payment gateway is configured. Checkout stays closed.'
    : payment.mode === 'test' ? 'The gateway is in a non-live payment environment. No real money is collected.'
    : payment.acceptingPayments ? 'Live gateway connected and accepting payments.' : 'Live gateway configured but not accepting payments.';
  return <StatusCard ok={payment.acceptingPayments && payment.mode === 'live'} icon={<CreditCard className="h-5 w-5" />} title={`Payments · ${payment.mode === 'test' ? 'Non-live' : payment.mode}`}>
    <span data-testid="text-payment-mode">{text} Webhook {payment.webhookConfigured ? 'configured' : 'not configured'}.</span>
  </StatusCard>;
}

function ItemRow({ item, canApprove, superAdmin }: { item: ApprovalReadinessItem; canApprove: boolean; superAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return <article className="rounded-2xl border border-border bg-card p-5" data-testid={`row-readiness-${item.id}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow text-[10px] text-muted-foreground">{KIND_LABEL[item.kind]}</span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', item.approved ? 'bg-leaf/15 text-leaf' : 'bg-muted text-muted-foreground')}>{item.approved ? 'Approved' : 'Not approved'}</span>
          <span className="font-mono text-xs text-muted-foreground">v{item.version}</span>
        </div>
        <h3 className="mt-1 truncate font-display text-xl text-emerald">{item.name}</h3>
      </div>
      <button type="button" onClick={() => setOpen(o => !o)} className="shrink-0 rounded-full border border-emerald px-4 py-2 text-sm font-semibold text-emerald hover:bg-emerald hover:text-ivory" data-testid={`button-review-${item.id}`}>{open ? 'Close' : item.approved ? 'Review or revoke' : 'Review for approval'}</button>
    </div>
    {item.blockers.length > 0 && <ul className="mt-3 space-y-1">{item.blockers.map(b => <li key={b} className="flex items-start gap-2 text-sm text-soil"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{b}</li>)}</ul>}
    {open && <DecisionForm item={item} canApprove={canApprove} superAdmin={superAdmin} onDone={() => setOpen(false)} />}
  </article>;
}

function DecisionForm({ item, canApprove, superAdmin, onDone }: { item: ApprovalReadinessItem; canApprove: boolean; superAdmin: boolean; onDone: () => void }) {
  const decision = item.approved ? 'revoke' : 'approve';
  const [reason, setReason] = useState(''), [evidence, setEvidence] = useState(''), [validUntil, setValidUntil] = useState('');
  const [inspectedOn, setInspectedOn] = useState(''), [qualification, setQualification] = useState(''), [override, setOverride] = useState('');
  const [attested, setAttested] = useState(false);
  const mutation = useRecordAdoptionApproval(), qc = useQueryClient(), { toast } = useToast();
  const approving = decision === 'approve';
  const valid = reason.trim().length >= 20 && attested && canApprove
    && (!approving || evidence.trim())
    && (!approving || item.kind === 'schemes' || validUntil)
    && (!approving || item.kind !== 'trees' || (inspectedOn && qualification.trim()))
    && (!override || override.trim().length >= 20);
  function submit() {
    mutation.mutate({ data: {
      recordId: item.id, version: item.version, decision, reason: reason.trim(), attested: true,
      ...(evidence.trim() ? { evidenceReference: evidence.trim() } : {}),
      ...(item.kind !== 'schemes' ? { validUntil: validUntil || null } : {}),
      ...(item.kind === 'trees' ? { inspectedOn: inspectedOn || null, qualification: qualification.trim() } : {}),
      ...(superAdmin && override.trim() ? { ownerOverrideReason: override.trim() } : {}),
    } }, {
      onSuccess: (r) => {
        qc.setQueryData(getGetAdoptionReadinessQueryKey(), r);
        void qc.invalidateQueries({ queryKey: getListManagedSchemesQueryKey() });
        void invalidateCatalogue(qc);
        toast({ title: approving ? 'Approval recorded' : 'Approval revoked', description: `${item.name} · v${item.version}` });
        onDone();
      },
    });
  }
  return <div className="mt-5 space-y-4 border-t border-border pt-5">
    {!canApprove && <p className="rounded-xl bg-harvest/10 p-3 text-sm text-soil">Confirm your second factor before recording a decision. <a href={stepUpHref} className="font-semibold underline">Confirm second factor</a></p>}
    <label className="block space-y-1.5 text-sm font-medium text-emerald">What you reviewed and why <span className="font-normal text-muted-foreground">(at least 20 characters)</span>
      <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} maxLength={4000} className="bg-background" data-testid={`input-reason-${item.id}`} />
      <span className="block text-xs font-normal text-muted-foreground">{reason.trim().length}/20 minimum</span>
    </label>
    {(approving || evidence) && <label className="block space-y-1.5 text-sm font-medium text-emerald">Evidence reference{approving && <span className="text-harvest"> *</span>}
      <Input value={evidence} onChange={e => setEvidence(e.target.value)} maxLength={500} className="bg-background" placeholder={item.kind === 'farms' ? 'e.g. land authority letter file no. held in private records' : 'Where the reviewed evidence is kept'} data-testid={`input-evidence-${item.id}`} />
      <span className="block text-xs font-normal text-muted-foreground">Reference an already-reviewed private or external document. Never upload private documents as public photos.</span>
    </label>}
    {approving && item.kind !== 'schemes' && <label className="block space-y-1.5 text-sm font-medium text-emerald">{item.kind === 'farms' ? 'Authority valid until' : 'Inspection review valid until'} <span className="text-harvest">*</span><Input type="date" value={validUntil} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={e => setValidUntil(e.target.value)} className="bg-background sm:w-56" data-testid={`input-valid-until-${item.id}`} /></label>}
    {approving && item.kind === 'trees' && <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
      <label className="block space-y-1.5 text-sm font-medium text-emerald">Inspected on <span className="text-harvest">*</span><Input type="date" value={inspectedOn} max={new Date().toISOString().slice(0, 10)} onChange={e => setInspectedOn(e.target.value)} className="bg-background" data-testid={`input-inspected-${item.id}`} /></label>
      <label className="block space-y-1.5 text-sm font-medium text-emerald">Inspector qualification <span className="text-harvest">*</span><Input value={qualification} onChange={e => setQualification(e.target.value)} maxLength={500} className="bg-background" placeholder="Who inspected and their qualification" data-testid={`input-qualification-${item.id}`} /></label>
    </div>}
    {superAdmin && <label className="block space-y-1.5 text-sm font-medium text-emerald">Reviewer separation override <span className="font-normal text-muted-foreground">(super-administrator only, leave blank unless you edited this record yourself)</span>
      <Input value={override} onChange={e => setOverride(e.target.value)} maxLength={2000} className="bg-background" data-testid={`input-override-${item.id}`} />
      {override && override.trim().length < 20 && <span className="block text-xs font-normal text-destructive">At least 20 characters explaining why separation is overridden.</span>}
    </label>}
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-secondary/60 p-3 text-sm">
      <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} className="mt-1 accent-emerald" data-testid={`checkbox-attest-${item.id}`} />
      <span>I personally reviewed the actual {item.kind === 'schemes' ? 'commercial terms' : 'records and photos'} of version {item.version} and the details above are true. Nothing here is inferred or assumed.</span>
    </label>
    {mutation.isError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{errorMessage(mutation.error)}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!valid || mutation.isPending} onClick={submit} className={cn('inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-ivory disabled:cursor-not-allowed disabled:opacity-45', approving ? 'bg-emerald' : 'bg-destructive')} data-testid={`button-decide-${item.id}`}>
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{approving ? `Approve version ${item.version}` : 'Revoke approval'}
      </button>
      {item.kind === 'schemes' && <Link href={`/manage/schemes/${item.id}`} className="rounded-full border border-border px-4 py-2.5 text-sm text-emerald">Open scheme</Link>}
    </div>
  </div>;
}
