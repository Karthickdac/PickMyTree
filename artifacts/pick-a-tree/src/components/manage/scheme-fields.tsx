import { useListManagedFarms, useListManagedTrees, type SchemeConfiguration } from '@workspace/api-client-react';
import { errorMessage, humanize } from '@/lib/brand';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export const newConfiguration = (): SchemeConfiguration => ({
  description: '', species: 'Mango', variety: '', farmId: null, treeIds: [],
  durationMonths: 12, feePaise: 0, taxBps: 0, allocationType: 'fixed-quantity',
  quantity: 10, unit: 'kg', sharePercent: 100, maxAdopters: 1,
  enrollmentStart: null, enrollmentEnd: null, season: '', roundingRule: 'down',
  qualityGrades: '', lossRules: '', fulfilmentMethods: ['pickup'],
  deliveryFeePaise: 0, deliveryRegions: '', fulfilmentPolicy: '', inclusions: '',
  exclusions: '', risks: '', shortfallPolicy: '', cancellationPolicy: '',
  renewalPolicy: '', agreementVersion: '', terms: '', legalReviewReference: '',
});

const selectStyle = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm';
const policyFields = [
  ['qualityGrades', 'Quality grades'], ['lossRules', 'Crop loss and deductions'],
  ['fulfilmentPolicy', 'Fulfilment and sale-settlement policy'],
  ['inclusions', 'Included benefits'], ['exclusions', 'Exclusions'],
  ['risks', 'Yield and other risks'], ['shortfallPolicy', 'Harvest shortfall remedy'],
  ['cancellationPolicy', 'Cancellation and refund policy'], ['renewalPolicy', 'Renewal terms'],
  ['terms', 'Agreement terms and capital repayment, if applicable'],
] as const;

export function SchemeFields({ value: c, onChange, disabled }: {
  value: SchemeConfiguration; onChange: (value: SchemeConfiguration) => void; disabled: boolean;
}) {
  const farms = useListManagedFarms();
  const trees = useListManagedTrees(c.farmId ?? '', { query: { enabled: !!c.farmId } });
  const set = <K extends keyof SchemeConfiguration>(key: K, value: SchemeConfiguration[K]) => {
    const next = { ...c, [key]: value };
    if (key === 'farmId' || key === 'species' || key === 'variety') next.treeIds = [];
    if (key === 'allocationType' && value === 'exclusive-harvest') { next.sharePercent = 100; next.maxAdopters = 1; next.quantity = null; }
    if (key === 'allocationType' && value === 'fixed-quantity' && !next.quantity) next.quantity = 10;
    if (key === 'allocationType' && value === 'sale-proceeds' && !next.fulfilmentMethods.includes('sale-settlement')) next.fulfilmentMethods = [...next.fulfilmentMethods, 'sale-settlement'];
    onChange(next);
  };
  const text = (key: 'description' | 'variety' | 'season' | 'deliveryRegions' | 'agreementVersion' | 'legalReviewReference', label: string, maxLength = 4000) => (
    <label className="block space-y-2 text-sm font-medium" key={key} htmlFor={`scheme-${key}`}>
      <span>{label}</span><Input id={`scheme-${key}`} value={c[key]} maxLength={maxLength} onChange={e => set(key, e.target.value)} />
    </label>
  );
  const numeric = (key: 'durationMonths' | 'feePaise' | 'taxBps' | 'quantity' | 'sharePercent' | 'maxAdopters' | 'deliveryFeePaise', label: string, min: number, max: number, scale = 1, step = 1) => (
    <label className="block space-y-2 text-sm font-medium" key={key} htmlFor={`scheme-${key}`}>
      <span>{label}</span><Input type="number" id={`scheme-${key}`} min={min} max={max} step={step}
        value={c[key] === null ? '' : Number(c[key]) / scale}
        onChange={e => set(key, (key === 'quantity' && e.target.value === '' ? null : scale === 1 ? Number(e.target.value) : Math.round(Number(e.target.value) * scale)) as never)} />
    </label>
  );
  const eligibleTrees = (trees.data ?? []).filter(t => t.status !== 'archived' && t.species === c.species && (!c.variety.trim() || t.variety.trim().toLowerCase() === c.variety.trim().toLowerCase()));
  return (
    <fieldset disabled={disabled} className="space-y-6 disabled:opacity-65">
      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-display text-2xl text-emerald">The scheme & its trees</h2>
        {text('description', 'Short description')}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium" htmlFor="scheme-species"><span className="block">Species</span><select className={selectStyle} id="scheme-species" value={c.species} onChange={e => set('species', e.target.value as SchemeConfiguration['species'])}>{['Mango', 'Guava', 'Coconut'].map(s => <option key={s}>{s}</option>)}</select></label>
          {text('variety', 'Variety · blank for all varieties', 120)}
          <label className="space-y-2 text-sm font-medium" htmlFor="scheme-farm"><span className="block">Farm</span><select id="scheme-farm" className={selectStyle} value={c.farmId ?? ''} onChange={e => set('farmId', e.target.value || null)}><option value="">Assign a farm later</option>{farms.data?.items.map(f => <option key={f.id} value={f.id}>{f.name}{f.status === 'archived' ? ' · archived' : ''}</option>)}</select></label>
          {text('season', 'Growing season', 120)}
        </div>
        {farms.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(farms.error)} <button type="button" onClick={() => farms.refetch()} className="underline">Retry farms</button></p>}
        <div><p className="mb-2 text-sm font-medium">Assigned trees</p><p className="mb-3 text-xs text-muted-foreground">Choose matching trees, or leave unassigned while configuring. A draft does not reserve harvest capacity.</p>
          {!c.farmId ? <p className="text-sm text-muted-foreground">Choose a farm to see its trees.</p> : trees.isLoading ? <p className="text-sm">Loading trees…</p> : trees.isError ? <p role="alert" className="text-sm text-destructive">{errorMessage(trees.error)} <button type="button" onClick={() => trees.refetch()} className="underline">Retry trees</button></p> : eligibleTrees.length ? <div className="grid gap-2 sm:grid-cols-2">{eligibleTrees.map(t => <label key={t.id} className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm"><input className="mt-1 accent-emerald" type="checkbox" checked={c.treeIds.includes(t.id)} onChange={e => set('treeIds', e.target.checked ? [...c.treeIds, t.id] : c.treeIds.filter(id => id !== t.id))} /><span>{t.name}<span className="block font-mono text-xs text-muted-foreground">{t.treeCode}</span></span></label>)}</div> : <p className="text-sm text-muted-foreground">No trees match this farm, species and variety.</p>}
          {c.treeIds.some(id => !eligibleTrees.some(t => t.id === id)) && <p className="mt-2 text-sm text-destructive">An assigned tree is no longer eligible. <button type="button" className="underline" onClick={() => set('treeIds', c.treeIds.filter(id => eligibleTrees.some(t => t.id === id)))}>Remove unavailable assignments</button></p>}
        </div>
      </section>
      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-display text-2xl text-emerald">Harvest benefits & price</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-2 text-sm font-medium" htmlFor="scheme-allocation"><span className="block">Entitlement</span><select id="scheme-allocation" className={selectStyle} value={c.allocationType} onChange={e => set('allocationType', e.target.value as SchemeConfiguration['allocationType'])}><option value="fixed-quantity">Fixed harvest quantity</option><option value="exclusive-harvest">Full tree harvest</option><option value="harvest-share">Percentage of harvest</option><option value="sale-proceeds">Harvest sale proceeds</option></select></label>
          {numeric('durationMonths', 'Duration · months', 1, 120)}
          {numeric('feePaise', 'Adoption fee · ₹', 0, 10000000, 100, 0.01)}
          {numeric('taxBps', 'Tax on adoption fee · %', 0, 100, 100, 0.01)}
          {c.allocationType === 'fixed-quantity' && numeric('quantity', 'Total harvest quantity', 0.001, 1000000, 1, c.unit === 'count' ? 1 : 0.001)}
          <label className="space-y-2 text-sm font-medium" htmlFor="scheme-unit"><span className="block">Harvest unit</span><select id="scheme-unit" className={selectStyle} value={c.unit} onChange={e => set('unit', e.target.value as SchemeConfiguration['unit'])}><option value="kg">Kilograms</option><option value="count">Count</option></select></label>
          {numeric('sharePercent', 'Harvest share · %', 0.01, 100, 1, 0.01)}
          {numeric('maxAdopters', 'Maximum adopters per tree', 1, 100000)}
          <label className="space-y-2 text-sm font-medium" htmlFor="scheme-rounding"><span className="block">Allocation rounding</span><select id="scheme-rounding" className={selectStyle} value={c.roundingRule} onChange={e => set('roundingRule', e.target.value as SchemeConfiguration['roundingRule'])}>{['down', 'nearest', 'up'].map(x => <option key={x} value={x}>{humanize(x)}</option>)}</select></label>
          {(['enrollmentStart', 'enrollmentEnd'] as const).map(key => <label key={key} className="space-y-2 text-sm font-medium" htmlFor={`scheme-${key}`}><span className="block">{key === 'enrollmentStart' ? 'Enrollment opens' : 'Enrollment closes'}</span><Input id={`scheme-${key}`} type="date" value={c[key] ?? ''} onChange={e => set(key, e.target.value || null)} /></label>)}
        </div>
        <p className="text-xs text-muted-foreground">Quantity applies across the configured duration. Full-tree harvest requires 100% share and one adopter. Prices and terms remain private until approved.</p>
      </section>
      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-display text-2xl text-emerald">Delivery & settlement</h2>
        <div className="flex flex-wrap gap-4">{(['pickup', 'delivery', 'sale-settlement'] as const).map(method => <label key={method} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald" checked={c.fulfilmentMethods.includes(method)} onChange={e => set('fulfilmentMethods', e.target.checked ? [...c.fulfilmentMethods, method] : c.fulfilmentMethods.filter(m => m !== method))} />{method === 'sale-settlement' ? 'Sell harvest & settle proceeds' : humanize(method)}</label>)}</div>
        <div className="grid gap-4 sm:grid-cols-2">{numeric('deliveryFeePaise', 'Delivery fee · ₹ · inclusive of tax', 0, 10000000, 100, 0.01)}{text('deliveryRegions', 'Delivery regions', 2000)}</div>
        <p className="text-xs text-muted-foreground">Harvest-sale proceeds are settled separately from the initial adoption payment. Define timing, costs and deductions in the policy below.</p>
      </section>
      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="font-display text-2xl text-emerald">Policies & agreement</h2>
        <div className="grid gap-4 sm:grid-cols-2">{text('agreementVersion', 'Agreement version', 120)}{text('legalReviewReference', 'Legal review reference', 500)}</div>
        <div className="grid gap-5 md:grid-cols-2">{policyFields.map(([key, label]) => <label key={key} htmlFor={`scheme-${key}`} className={`space-y-2 text-sm font-medium ${key === 'terms' ? 'md:col-span-2' : ''}`}><span className="block">{label}</span><Textarea id={`scheme-${key}`} value={c[key]} maxLength={key === 'terms' ? 20000 : key === 'qualityGrades' ? 2000 : 4000} rows={key === 'terms' ? 6 : 3} onChange={e => set(key, e.target.value)} /></label>)}</div>
      </section>
    </fieldset>
  );
}
