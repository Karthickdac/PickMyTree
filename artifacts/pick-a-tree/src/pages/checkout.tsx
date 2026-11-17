import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, FileText, Loader2, Lock, Printer, RefreshCw, TreeDeciduous } from 'lucide-react';
import {
  getGetAdoptionCheckoutQueryKey, getGetAdoptionOrderQueryKey, getGetCustomerDashboardQueryKey, getGetMeQueryKey,
  useGetAdoptionCheckout, useGetAdoptionOrder, useGetMe, useReserveAdoption, useStartAdoptionPayment, useVerifyAdoptionPayment,
  type AdoptionCheckout, type AdoptionOffer, type AdoptionOrder, type AdoptionReservationInputFulfilment,
} from '@workspace/api-client-react';
import { EmptyState, ErrorState, Section } from '@/components/site/bits';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, errorStatus, formatDate, formatPaise, useSeo } from '@/lib/brand';
import { invalidateCatalogue } from '@/lib/manage';
import { cn } from '@/lib/utils';

const FULFIL: Record<string, string> = { pickup: 'Collect from the farm', delivery: 'Deliver my harvest', 'sale-settlement': 'Sell the harvest and settle proceeds later' };
const btn = 'inline-flex items-center justify-center gap-2 rounded-full bg-emerald px-6 py-3 text-sm font-semibold text-ivory transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45';
const btn2 = 'inline-flex items-center justify-center gap-2 rounded-full border border-emerald px-5 py-2.5 text-sm font-semibold text-emerald';

function PaymentModeNote({ mode }: { mode: string }) {
  if (mode !== 'test') return null;
  return <p className="rounded-xl border border-harvest/40 bg-harvest/10 p-3 text-xs text-soil" data-testid="text-nonlive">Non-live payment environment. Payments here are not real and no money is collected.</p>;
}

/* ---------------- Checkout ---------------- */

const KEY_STORE = 'pmt-reserve-keys';
function idempotencyKeyFor(fingerprint: string) {
  let map: Record<string, string> = {};
  try { map = JSON.parse(sessionStorage.getItem(KEY_STORE) || '{}'); } catch { map = {}; }
  if (!map[fingerprint]) { map[fingerprint] = crypto.randomUUID(); sessionStorage.setItem(KEY_STORE, JSON.stringify(map)); }
  return map[fingerprint];
}
function clearKey(fingerprint: string) {
  try { const map = JSON.parse(sessionStorage.getItem(KEY_STORE) || '{}'); delete map[fingerprint]; sessionStorage.setItem(KEY_STORE, JSON.stringify(map)); } catch { /* ignore */ }
}

export function CheckoutPage() {
  const { treeId = '' } = useParams<{ treeId: string }>();
  const preferred = new URLSearchParams(useSearch()).get('offer');
  const q = useGetAdoptionCheckout(treeId, { query: { enabled: !!treeId, queryKey: getGetAdoptionCheckoutQueryKey(treeId) } });
  useSeo('Review & adopt', 'Choose an approved harvest scheme and reserve your tree.');
  if (q.isLoading) return <Section><Skeleton className="h-6 w-32" /><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div></Section>;
  if (q.isError || !q.data) return <Section>{errorStatus(q.error) === 404
    ? <EmptyState icon={<TreeDeciduous className="h-6 w-6" />} title="This tree is not open for adoption." body="It may be reserved, paused, or not yet approved."><Link href="/adopt" className={btn}>Back to catalogue</Link></EmptyState>
    : <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}</Section>;
  return <CheckoutForm key={treeId} data={q.data} preferred={preferred} />;
}

function CheckoutForm({ data, preferred }: { data: AdoptionCheckout; preferred: string | null }) {
  const { tree, offers, payment, blockers } = data;
  const [offerId, setOfferId] = useState(() => offers.find(o => o.id === preferred)?.id ?? offers[0]?.id ?? '');
  const offer = offers.find(o => o.id === offerId);
  const [fulfilment, setFulfilment] = useState('');
  const method = offer?.fulfilmentMethods.includes(fulfilment) ? fulfilment : offer?.fulfilmentMethods[0] ?? '';
  const [name, setName] = useState(''), [address, setAddress] = useState(''), [accepted, setAccepted] = useState(false);
  const me = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const reserve = useReserveAdoption(), qc = useQueryClient();
  const [, navigate] = useLocation();
  useEffect(() => { setAccepted(false); }, [offerId]);
  useEffect(() => { if (me.data && !name) setName(me.data.profile.displayName || me.data.displayName || ''); }, [me.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (me.data?.profile.address && !address) setAddress(me.data.profile.address); }, [me.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = offers.length > 0 && !!tree.adoptionEligible && payment.acceptingPayments && blockers.length === 0;
  const isDelivery = method === 'delivery';
  const tax = offer ? Math.round(offer.feePaise * offer.taxBps / 10000) : 0;
  const delivery = offer && isDelivery ? offer.deliveryFeePaise : 0;
  const valid = !!offer && !!method && name.trim().length >= 2 && (!isDelivery || address.trim().length >= 10) && accepted;
  const signedIn = !!me.data;
  const returnTo = `/checkout/${tree.id}`;

  function submit() {
    if (!offer || !valid) return;
    const payload = { treeId: tree.id, offerId: offer.id, fulfilment: method as AdoptionReservationInputFulfilment, name: name.trim(), ...(isDelivery ? { deliveryAddress: address.trim() } : {}), acceptedTerms: true as const };
    const fingerprint = JSON.stringify([payload, offer.version, offer.agreementVersion]);
    reserve.mutate({ data: { ...payload, idempotencyKey: idempotencyKeyFor(fingerprint) } }, {
      onSuccess: (order) => {
        clearKey(fingerprint);
        qc.setQueryData(getGetAdoptionOrderQueryKey(order.id), order);
        void qc.invalidateQueries({ queryKey: getGetAdoptionCheckoutQueryKey(tree.id) });
        void qc.invalidateQueries({ queryKey: getGetCustomerDashboardQueryKey() });
        void invalidateCatalogue(qc);
        navigate(`/adoption-orders/${order.id}`);
      },
    });
  }

  return <Section className="pb-14 pt-6 md:pt-6">
    <Link href={`/adopt/${tree.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald" data-testid="link-back-tree"><ArrowLeft className="h-4 w-4" />{tree.name}</Link>
    <div className="mt-5 flex items-center gap-4">
      {(tree.images?.[0]?.url ?? tree.image) && <img src={tree.images?.[0]?.url ?? tree.image} alt={tree.name} className="h-16 w-16 rounded-xl object-cover" />}
      <div><p className="font-mono text-xs text-harvest">{tree.treeCode} · {tree.farmName}</p><h1 className="text-3xl font-light text-emerald md:text-4xl">Review & adopt</h1></div>
    </div>
    {!open ? <div className="mt-8 rounded-2xl border border-border bg-card p-6" data-testid="panel-checkout-closed">
      <p className="flex items-center gap-2 font-semibold text-emerald"><Lock className="h-4 w-4" />Adoption is not open for this tree right now</p>
      <ul className="mt-3 space-y-1.5">{(blockers.length ? blockers : [
        ...(offers.length ? [] : ['No approved scheme is attached to this tree.']),
        ...(tree.adoptionEligible ? [] : ['The tree is not approved for adoption.']),
        ...(payment.acceptingPayments ? [] : ['Payments are not being accepted.']),
      ]).map(b => <li key={b} className="flex items-start gap-2 text-sm text-soil"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{b}</li>)}</ul>
      <Link href="/contact" className="mt-5 inline-block text-sm font-semibold text-emerald underline underline-offset-4">Ask about this tree</Link>
    </div> : <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Step n={1} title="Choose an approved scheme">
          <div className="space-y-2">{offers.map(o => <label key={o.id} className={cn('flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors', o.id === offerId ? 'border-emerald bg-secondary/50' : 'border-border hover:border-leaf')} data-testid={`option-offer-${o.id}`}>
            <input type="radio" name="offer" className="mt-1 accent-emerald" checked={o.id === offerId} onChange={() => setOfferId(o.id)} />
            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-display text-lg text-emerald">{o.name}</span><span className="font-semibold text-harvest">{formatPaise(o.feePaise)}</span></span>
              <span className="block text-sm text-foreground/80">{o.benefit}</span>
              <span className="block font-mono text-xs text-muted-foreground">Version {o.version} · {o.durationMonths} months · agreement {o.agreementVersion}</span></span>
          </label>)}</div>
        </Step>
        {offer && <Step n={2} title="How would you like your harvest?">
          <div className="grid gap-2 sm:grid-cols-3">{offer.fulfilmentMethods.map(m => <label key={m} className={cn('flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm', method === m ? 'border-emerald bg-secondary/50' : 'border-border')} data-testid={`option-fulfilment-${m}`}>
            <input type="radio" name="fulfil" className="accent-emerald" checked={method === m} onChange={() => setFulfilment(m)} />{FULFIL[m] ?? m}</label>)}</div>
          {method === 'sale-settlement' && <p className="mt-3 rounded-xl bg-secondary p-3 text-sm">The adoption fee is paid now. Any later harvest-sale proceeds depend on actual yield, sale prices and the scheme's deductions, and are never guaranteed. Settlement details are collected later, not now.</p>}
          {isDelivery && <p className="mt-3 text-sm text-muted-foreground">Delivers to: {offer.deliveryRegions || 'regions not stated'}. Delivery fee {formatPaise(offer.deliveryFeePaise)}, tax inclusive.</p>}
          {offer.fulfilmentPolicy && <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{offer.fulfilmentPolicy}</p>}
        </Step>}
        <Step n={3} title="Your details">
          <label className="block space-y-1.5 text-sm font-medium text-emerald">Adopter name<Input value={name} onChange={e => setName(e.target.value)} maxLength={120} className="bg-background" data-testid="input-adopter-name" /></label>
          {isDelivery && <label className="mt-4 block space-y-1.5 text-sm font-medium text-emerald">Delivery address<Textarea rows={3} value={address} onChange={e => setAddress(e.target.value)} maxLength={2000} className="bg-background" placeholder="House, street, town, district, PIN" data-testid="input-delivery-address" /></label>}
        </Step>
        {offer && <Step n={4} title={`Agreement ${offer.agreementVersion}`}>
          <AgreementText offer={offer} />
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-secondary/60 p-3 text-sm">
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 accent-emerald" data-testid="checkbox-accept-terms" />
            <span>I have read and accept agreement {offer.agreementVersion} for {offer.name} version {offer.version}, exactly as shown above, including the risks and shortfall policy.</span>
          </label>
        </Step>}
      </div>
      <aside className="space-y-4 rounded-2xl bg-emerald p-6 text-ivory lg:sticky lg:top-24">
        <p className="eyebrow text-ivory/65">Estimate</p>
        {offer && <dl className="space-y-2 text-sm">
          <Row k="Adoption fee" v={formatPaise(offer.feePaise)} /><Row k={`Tax (${offer.taxBps / 100}%)`} v={formatPaise(tax)} />{isDelivery && <Row k="Delivery, tax inclusive" v={formatPaise(delivery)} />}
          <div className="flex justify-between border-t border-ivory/20 pt-3 text-xl font-semibold"><dt>Total</dt><dd data-testid="text-estimate-total">{formatPaise(offer.feePaise + tax + delivery)}</dd></div>
        </dl>}
        <p className="text-xs text-ivory/70">The reservation shows the confirmed total from our server. You pay on the next screen; the tree is held for a limited time.</p>
        {payment.mode === 'test' && <p className="rounded-xl bg-ivory/10 p-3 text-xs">Non-live payment environment. No real money is collected.</p>}
        {reserve.isError && <p role="alert" className="rounded-xl bg-ivory p-3 text-sm text-destructive">{errorMessage(reserve.error)}{errorStatus(reserve.error) === undefined && ' Retrying is safe; the same request will not reserve twice.'}</p>}
        {me.isLoading ? <Skeleton className="h-12 rounded-full bg-ivory/20" /> : signedIn
          ? <button type="button" disabled={!valid || reserve.isPending} onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-full bg-harvest px-5 py-3 font-semibold text-ivory disabled:opacity-45" data-testid="button-reserve">{reserve.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Reserve & continue to payment</button>
          : <Link href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`} className="flex w-full items-center justify-center gap-2 rounded-full bg-harvest px-5 py-3 font-semibold text-ivory" data-testid="link-signin-continue"><Lock className="h-4 w-4" />Sign in with mobile to reserve</Link>}
        {signedIn && !valid && <p className="text-xs text-ivory/70">{!accepted ? 'Accept the agreement to continue.' : name.trim().length < 2 ? 'Enter the adopter name.' : 'Enter a delivery address.'}</p>}
      </aside>
    </div>}
  </Section>;
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-5 md:p-6"><h2 className="mb-4 flex items-center gap-3 text-xl text-emerald"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald font-mono text-xs text-ivory">{n}</span>{title}</h2>{children}</section>;
}
function Row({ k, v }: { k: string; v: string }) { return <div className="flex justify-between gap-4"><dt className="opacity-80">{k}</dt><dd>{v}</dd></div>; }

function AgreementText({ offer }: { offer: AdoptionOffer }) {
  const parts: [string, string][] = [['Benefit', offer.benefit], ['Included', offer.inclusions], ['Not included', offer.exclusions], ['Risks', offer.risks], ['Harvest shortfall', offer.shortfallPolicy], ['Fulfilment', offer.fulfilmentPolicy], ['Delivery regions', offer.deliveryRegions], ['Cancellation', offer.cancellationPolicy], ['Terms', offer.terms]];
  return <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm print:max-h-none print:overflow-visible" data-testid="text-agreement">
    {parts.filter(([, v]) => v).map(([k, v]) => <div key={k}><p className="eyebrow text-[10px] text-muted-foreground">{k}</p><p className="mt-1 whitespace-pre-line leading-relaxed">{v}</p></div>)}
  </div>;
}

/* ---------------- Order ---------------- */

type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (e: string, cb: (r: { error?: { description?: string } }) => void) => void };
declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => RazorpayInstance } }
let scriptPromise: Promise<void> | null = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.async = true;
    s.onload = () => window.Razorpay ? resolve() : reject(new Error('Payment window did not initialise.'));
    s.onerror = () => { scriptPromise = null; s.remove(); reject(new Error('Could not load the payment window. Check your connection and try again.')); };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

const PENDING = ['reserved', 'creating-payment', 'payment-pending'];

export function AdoptionOrderPage() {
  const { id = '' } = useParams<{ id: string }>();
  useSeo('Your adoption', 'Reservation, payment and agreement.');
  const q = useGetAdoptionOrder(id, { query: { enabled: !!id, queryKey: getGetAdoptionOrderQueryKey(id), refetchInterval: (query) => PENDING.includes(query.state.data?.status ?? '') ? 8000 : false } });
  if (q.isLoading) return <Section><Skeleton className="h-10 w-1/2" /><Skeleton className="mt-6 h-80 rounded-2xl" /></Section>;
  if (q.isError || !q.data) return <Section>{errorStatus(q.error) === 404
    ? <EmptyState icon={<FileText className="h-6 w-6" />} title="Reservation not found." body="It may belong to a different account."><Link href="/portal/adoptions" className={btn}>My adoptions</Link></EmptyState>
    : <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}</Section>;
  return <OrderView order={q.data} refetch={() => q.refetch()} refetching={q.isFetching} />;
}

function useCountdown(to: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  return { ms, label: `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}` };
}

function OrderView({ order, refetch, refetching }: { order: AdoptionOrder; refetch: () => void; refetching: boolean }) {
  const qc = useQueryClient();
  const start = useStartAdoptionPayment(), verify = useVerifyAdoptionPayment();
  const [notice, setNotice] = useState(''), [loading, setLoading] = useState(false), [verifyFailed, setVerifyFailed] = useState(false);
  const { ms, label } = useCountdown(order.expiresAt);
  const verifyRef = useRef(verify.mutate); verifyRef.current = verify.mutate;
  const held = PENDING.includes(order.status) && ms > 0;

  const settle = useMemo(() => (o: AdoptionOrder) => {
    qc.setQueryData(getGetAdoptionOrderQueryKey(o.id), o);
    if (o.status === 'active') {
      void qc.invalidateQueries({ queryKey: getGetCustomerDashboardQueryKey() });
      void qc.invalidateQueries({ queryKey: getGetAdoptionCheckoutQueryKey(o.treeId) });
      void invalidateCatalogue(qc);
    }
  }, [qc]);

  async function pay() {
    setNotice(''); setVerifyFailed(false); setLoading(true);
    try {
      const session = await start.mutateAsync({ orderId: order.id });
      settle(session.order);
      await loadRazorpay();
      const Rz = window.Razorpay!;
      const rz = new Rz({
        key: session.keyId, order_id: session.providerOrderId, amount: session.amount, currency: session.currency, name: 'Pick My Tree',
        description: `${order.treeCode} · ${order.schemeName}`, prefill: { name: session.name, contact: session.contact }, theme: { color: '#0e3d2c' },
        handler: (r: RazorpayResponse) => {
          setNotice('Confirming your payment with our server. Do not pay again.');
          verifyRef.current({ orderId: order.id, data: { paymentId: r.razorpay_payment_id, providerOrderId: r.razorpay_order_id, signature: r.razorpay_signature } }, {
            onSuccess: (o) => { settle(o); setNotice(o.status === 'active' ? '' : o.message); },
            onError: () => { setVerifyFailed(true); setNotice('We could not reach our server to confirm the payment. Check status instead of paying again.'); },
          });
        },
        modal: { ondismiss: () => setNotice((n) => n || 'Payment window closed. Your reservation is still held; you can try again before it expires.') },
      });
      rz.on('payment.failed', (r) => setNotice(`Payment was not completed${r.error?.description ? `: ${r.error.description}` : ''}. Your reservation is still held.`));
      rz.open();
    } catch (e) {
      setNotice(errorMessage(e));
    } finally { setLoading(false); }
  }

  const header = <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
    <Link href={`/adopt/${order.treeId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald"><ArrowLeft className="h-4 w-4" />{order.treeName}</Link>
    <button type="button" onClick={refetch} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="button-refresh-order"><RefreshCw className={cn('h-3.5 w-3.5', refetching && 'animate-spin')} />Refresh status</button>
  </div>;
  const totals = <dl className="space-y-2 text-sm">
    <Row k="Adoption fee" v={formatPaise(order.feePaise)} /><Row k="Tax" v={formatPaise(order.taxPaise)} />{order.deliveryFeePaise > 0 && <Row k="Delivery, tax inclusive" v={formatPaise(order.deliveryFeePaise)} />}
    <div className="flex justify-between border-t border-current/20 pt-3 text-lg font-semibold"><dt>Total</dt><dd data-testid="text-order-total">{formatPaise(order.totalPaise)}</dd></div>
  </dl>;
  const facts = <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
    {[['Tree', `${order.treeName} (${order.treeCode})`], ['Scheme', `${order.schemeName} · v${order.schemeVersion}`], ['Harvest', FULFIL[order.fulfilment] ?? order.fulfilment], ['Reference', order.id], ['Reserved', formatDate(order.createdAt)], ...(order.paymentId ? [['Payment ID', order.paymentId]] : [])].map(([k, v]) =>
      <div key={k} className="min-w-0"><dt className="eyebrow text-[10px] text-muted-foreground">{k}</dt><dd className="mt-1 break-all font-medium">{v}</dd></div>)}
  </dl>;

  if (order.status === 'active') return <Section className="pt-6 md:pt-6">{header}
    <div className="mt-6 rounded-2xl border border-leaf/40 bg-card p-6 md:p-8" data-testid="panel-receipt">
      <p className="flex items-center gap-2 font-semibold text-leaf"><CheckCircle2 className="h-5 w-5" />Adoption active</p>
      <h1 className="mt-2 text-3xl font-light text-emerald">Receipt</h1>
      <p className="mt-1 text-sm text-muted-foreground">Activated {formatDate(order.activatedAt)}{order.endsAt ? ` · runs until ${formatDate(order.endsAt)}` : ''}</p>
      <div className="mt-6">{facts}</div>
      <div className="mt-6 max-w-sm">{totals}</div>
      {order.paymentMode === 'test' && <div className="mt-4"><PaymentModeNote mode="test" /></div>}
      <h2 className="mt-8 text-xl text-emerald">Accepted agreement {order.agreement.agreementVersion}</h2>
      <div className="mt-3"><AgreementText offer={order.agreement} /></div>
      <div className="mt-6 flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={btn} data-testid="button-print-receipt"><Printer className="h-4 w-4" />Print receipt</button>
        <Link href={`/adopt/${order.treeId}`} className={btn2}>View tree</Link><Link href="/portal/trees" className={btn2}>My trees</Link>
      </div>
    </div>
  </Section>;

  return <Section className="pt-6 md:pt-6">{header}
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
        <div><p className="eyebrow text-muted-foreground">Reservation</p><h1 className="mt-1 text-3xl font-light text-emerald">{order.treeName}</h1></div>
        {facts}
        {order.message && <p className="text-sm text-foreground/80" data-testid="text-order-message">{order.message}</p>}
        <details className="border-t border-border pt-4"><summary className="cursor-pointer text-sm font-semibold">Accepted agreement {order.agreement.agreementVersion}</summary><div className="mt-3"><AgreementText offer={order.agreement} /></div></details>
      </div>
      <aside className="space-y-4 rounded-2xl bg-emerald p-6 text-ivory">
        {totals}
        <PaymentModeNote mode={order.paymentMode} />
        {order.status === 'payment-review' ? <div className="rounded-xl bg-ivory p-4 text-sm text-emerald" data-testid="panel-payment-review">
          <p className="font-semibold">Payment under review</p><p className="mt-1">Money may have reached us, but this adoption needs a manual check before it activates. It is not marked failed or unpaid. Quote reference <span className="font-mono">{order.id}</span>{order.paymentId ? ` and payment ${order.paymentId}` : ''} when contacting support.</p>
          <Link href="/portal/support" className="mt-3 inline-block font-semibold underline">Contact support</Link>
        </div> : order.status === 'expired' || !held ? <div className="space-y-3" data-testid="panel-expired">
          <p className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" />Reservation expired</p><p className="text-sm text-ivory/75">This hold has ended and can no longer be paid. Start again from the tree if it is still available.</p>
          <Link href={`/adopt/${order.treeId}`} className="flex w-full items-center justify-center rounded-full bg-harvest px-5 py-3 font-semibold text-ivory">Back to {order.treeName}</Link>
        </div> : <>
          <p className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" />Held for <span className="font-mono text-lg" data-testid="text-countdown">{label}</span></p>
          {verifyFailed ? <button type="button" onClick={() => { setVerifyFailed(false); setNotice(''); refetch(); }} className="flex w-full items-center justify-center gap-2 rounded-full bg-harvest px-5 py-3 font-semibold text-ivory" data-testid="button-check-status"><RefreshCw className="h-4 w-4" />Check payment status</button>
            : <button type="button" onClick={pay} disabled={loading || verify.isPending || order.status === 'creating-payment'} className="flex w-full items-center justify-center gap-2 rounded-full bg-harvest px-5 py-3 font-semibold text-ivory disabled:opacity-50" data-testid="button-pay">
              {(loading || verify.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}{verify.isPending ? 'Confirming payment' : order.status === 'payment-pending' ? 'Retry payment' : `Pay ${formatPaise(order.totalPaise)}`}</button>}
          {order.status === 'payment-pending' && !notice && <p className="text-xs text-ivory/75">If you already completed payment, it will be confirmed here automatically. Check status before paying again.</p>}
        </>}
        {notice && <p role="status" className="rounded-xl bg-ivory/10 p-3 text-sm" data-testid="text-payment-notice">{notice}</p>}
      </aside>
    </div>
  </Section>;
}

