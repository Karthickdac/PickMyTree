import { useQueryClient } from '@tanstack/react-query';
import {
  getGetManagedSchemeQueryKey, getGetWorkspaceSummaryQueryKey, getListManagedSchemesQueryKey, getListSchemeRevisionsQueryKey,
  type ManagedScheme, type ManagedTree, type SchemeConfiguration, type SchemeConfigurationAllocationType,
  type SchemeConfigurationFulfilmentMethodsItem, type SchemeConfigurationRoundingRule, type SchemeConfigurationSpecies, type SchemeConfigurationUnit,
} from '@workspace/api-client-react';

/**
 * Scheme management is restricted server-side to administrator / super-administrator grants with scope "*".
 * /me only exposes role names (no scope), so this is a navigation hint; the API's 403 is the real gate.
 * Farm-managers are deliberately excluded.
 */
export const SCHEME_ADMIN_ROLES = ['administrator', 'super-administrator'];
export function canManageSchemes(roles?: string[] | null) {
  return !!roles?.some((r) => {
    const [role, scope] = r.split(':').map((s) => s.trim().toLowerCase().replace(/_/g, '-'));
    return SCHEME_ADMIN_ROLES.includes(role) && (scope === undefined || scope === '*');
  });
}

export const ALLOCATIONS: { value: SchemeConfigurationAllocationType; label: string; short: string; full: boolean }[] = [
  { value: 'fixed-quantity', label: 'Fixed quantity', short: 'A set amount of fruit per adopter', full: false },
  { value: 'harvest-share', label: 'Harvest share', short: 'A percentage of the measured harvest', full: true },
  { value: 'exclusive-harvest', label: 'Exclusive full harvest', short: 'One adopter, 100% of measured harvest', full: true },
  { value: 'sale-proceeds', label: 'Sale proceeds', short: 'Harvest is sold; actual proceeds are settled later', full: true },
];
export const METHODS: { value: SchemeConfigurationFulfilmentMethodsItem; label: string; hint: string }[] = [
  { value: 'pickup', label: 'Farm pickup', hint: 'Adopter collects at the farm' },
  { value: 'delivery', label: 'Delivery', hint: 'Shipped to configured regions' },
  { value: 'sale-settlement', label: 'Sale settlement', hint: 'Harvest sold, actual proceeds paid later' },
];
export const SPECIES_LIST: SchemeConfigurationSpecies[] = ['Mango', 'Guava', 'Coconut'];

export type SchemeDraft = {
  name: string;
  description: string; species: SchemeConfigurationSpecies; variety: string; farmId: string | null; treeIds: string[];
  durationMonths: string; feeRupees: string; taxPercent: string;
  allocationType: SchemeConfigurationAllocationType; quantity: string; unit: SchemeConfigurationUnit; sharePercent: string; maxAdopters: string;
  enrollmentStart: string; enrollmentEnd: string; season: string; roundingRule: SchemeConfigurationRoundingRule;
  qualityGrades: string; lossRules: string; fulfilmentMethods: SchemeConfigurationFulfilmentMethodsItem[]; deliveryFeeRupees: string;
  deliveryRegions: string; fulfilmentPolicy: string; inclusions: string; exclusions: string; risks: string; shortfallPolicy: string;
  cancellationPolicy: string; renewalPolicy: string; agreementVersion: string; terms: string; legalReviewReference: string;
};
export type DraftErrors = Partial<Record<keyof SchemeDraft, string>>;

export const INITIAL_CONFIGURATION: SchemeConfiguration = {
  description: '', species: 'Mango', variety: '', farmId: null, treeIds: [], durationMonths: 12, feePaise: 0, taxBps: 0,
  allocationType: 'fixed-quantity', quantity: 10, unit: 'kg', sharePercent: 100, maxAdopters: 1, enrollmentStart: null, enrollmentEnd: null,
  season: '', roundingRule: 'down', qualityGrades: '', lossRules: '', fulfilmentMethods: ['pickup'], deliveryFeePaise: 0, deliveryRegions: '',
  fulfilmentPolicy: '', inclusions: '', exclusions: '', risks: '', shortfallPolicy: '', cancellationPolicy: '', renewalPolicy: '',
  agreementVersion: '', terms: '', legalReviewReference: '',
};

const paiseToRupees = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));
const bpsToPercent = (b: number) => (b % 100 === 0 ? String(b / 100) : (b / 100).toFixed(2).replace(/0$/, ''));

export function toDraft(s: Pick<ManagedScheme, 'name' | 'configuration'>): SchemeDraft {
  const c = s.configuration;
  return {
    name: s.name, description: c.description, species: c.species, variety: c.variety, farmId: c.farmId, treeIds: [...c.treeIds],
    durationMonths: String(c.durationMonths), feeRupees: paiseToRupees(c.feePaise), taxPercent: bpsToPercent(c.taxBps),
    allocationType: c.allocationType, quantity: c.quantity == null ? '' : String(c.quantity), unit: c.unit, sharePercent: String(c.sharePercent),
    maxAdopters: String(c.maxAdopters), enrollmentStart: c.enrollmentStart ?? '', enrollmentEnd: c.enrollmentEnd ?? '', season: c.season,
    roundingRule: c.roundingRule, qualityGrades: c.qualityGrades, lossRules: c.lossRules, fulfilmentMethods: [...c.fulfilmentMethods],
    deliveryFeeRupees: paiseToRupees(c.deliveryFeePaise), deliveryRegions: c.deliveryRegions, fulfilmentPolicy: c.fulfilmentPolicy,
    inclusions: c.inclusions, exclusions: c.exclusions, risks: c.risks, shortfallPolicy: c.shortfallPolicy, cancellationPolicy: c.cancellationPolicy,
    renewalPolicy: c.renewalPolicy, agreementVersion: c.agreementVersion, terms: c.terms, legalReviewReference: c.legalReviewReference,
  };
}

const MONEY = /^\d+(\.\d{1,2})?$/;
export function rupeesToPaise(v: string): number | null {
  const t = v.trim();
  if (!MONEY.test(t)) return null;
  return Math.round(Number(t) * 100);
}
export function percentToBps(v: string): number | null {
  const t = v.trim();
  if (!MONEY.test(t)) return null;
  return Math.round(Number(t) * 100);
}
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateDraft(d: SchemeDraft): DraftErrors {
  const e: DraftErrors = {};
  const n = d.name.trim();
  if (n.length < 2 || n.length > 200) e.name = 'Name needs 2 to 200 characters.';
  const dur = Number(d.durationMonths);
  if (!/^\d+$/.test(d.durationMonths.trim()) || dur < 1 || dur > 120) e.durationMonths = 'Whole months from 1 to 120.';
  const fee = rupeesToPaise(d.feeRupees);
  if (fee === null || fee > 1_000_000_000) e.feeRupees = 'Rupees with up to 2 decimals (max 1,00,00,000).';
  const tax = percentToBps(d.taxPercent);
  if (tax === null || tax > 10000) e.taxPercent = 'Percent from 0 to 100, up to 2 decimals.';
  const del = rupeesToPaise(d.deliveryFeeRupees);
  if (del === null || del > 1_000_000_000) e.deliveryFeeRupees = 'Rupees with up to 2 decimals.';
  if (d.allocationType === 'fixed-quantity') {
    const q = Number(d.quantity);
    if (d.quantity.trim() === '' || !Number.isFinite(q) || q <= 0 || q > 1_000_000) e.quantity = 'Fixed quantity needs a positive amount (max 10,00,000).';
    else if (d.unit === 'count' && !Number.isInteger(q)) e.quantity = 'A count must be a whole number.';
  }
  const sp = Number(d.sharePercent);
  if (d.sharePercent.trim() === '' || !Number.isFinite(sp) || sp <= 0 || sp > 100) e.sharePercent = 'Greater than 0 and at most 100.';
  const ma = Number(d.maxAdopters);
  if (!/^\d+$/.test(d.maxAdopters.trim()) || ma < 1 || ma > 100000) e.maxAdopters = 'Whole number from 1 to 1,00,000.';
  if (d.allocationType === 'exclusive-harvest') {
    if (sp !== 100) e.sharePercent = 'Exclusive harvest is always 100%.';
    if (ma !== 1) e.maxAdopters = 'Exclusive harvest allows exactly one adopter.';
  }
  if (d.enrollmentStart && !DATE.test(d.enrollmentStart)) e.enrollmentStart = 'Use YYYY-MM-DD.';
  if (d.enrollmentEnd && !DATE.test(d.enrollmentEnd)) e.enrollmentEnd = 'Use YYYY-MM-DD.';
  if (d.enrollmentStart && d.enrollmentEnd && d.enrollmentEnd < d.enrollmentStart) e.enrollmentEnd = 'Ends before it starts.';
  if (d.fulfilmentMethods.length === 0) e.fulfilmentMethods = 'Allow at least one fulfilment method.';
  else if (d.allocationType === 'sale-proceeds' && !d.fulfilmentMethods.includes('sale-settlement')) e.fulfilmentMethods = 'Sale proceeds requires sale settlement.';
  if (d.treeIds.length > 0 && (!d.farmId || !d.variety.trim())) e.treeIds = 'Trees need a farm and a variety.';
  if (d.treeIds.length > 500) e.treeIds = 'At most 500 trees.';
  const limits: [keyof SchemeDraft, number][] = [['description', 4000], ['variety', 120], ['season', 120], ['qualityGrades', 2000], ['lossRules', 4000],
    ['deliveryRegions', 2000], ['fulfilmentPolicy', 4000], ['inclusions', 4000], ['exclusions', 4000], ['risks', 4000], ['shortfallPolicy', 4000],
    ['cancellationPolicy', 4000], ['renewalPolicy', 4000], ['agreementVersion', 120], ['terms', 20000], ['legalReviewReference', 500]];
  for (const [k, max] of limits) if ((d[k] as string).length > max) e[k] = `At most ${max} characters.`;
  return e;
}

export function toConfiguration(d: SchemeDraft): SchemeConfiguration {
  return {
    description: d.description, species: d.species, variety: d.variety.trim(), farmId: d.farmId, treeIds: d.treeIds,
    durationMonths: Number(d.durationMonths), feePaise: rupeesToPaise(d.feeRupees) ?? 0, taxBps: percentToBps(d.taxPercent) ?? 0,
    allocationType: d.allocationType, quantity: d.allocationType === 'fixed-quantity' ? Number(d.quantity) : null, unit: d.unit,
    sharePercent: Number(d.sharePercent), maxAdopters: Number(d.maxAdopters),
    enrollmentStart: d.enrollmentStart || null, enrollmentEnd: d.enrollmentEnd || null, season: d.season, roundingRule: d.roundingRule,
    qualityGrades: d.qualityGrades, lossRules: d.lossRules, fulfilmentMethods: d.fulfilmentMethods, deliveryFeePaise: rupeesToPaise(d.deliveryFeeRupees) ?? 0,
    deliveryRegions: d.deliveryRegions, fulfilmentPolicy: d.fulfilmentPolicy, inclusions: d.inclusions, exclusions: d.exclusions, risks: d.risks,
    shortfallPolicy: d.shortfallPolicy, cancellationPolicy: d.cancellationPolicy, renewalPolicy: d.renewalPolicy, agreementVersion: d.agreementVersion,
    terms: d.terms, legalReviewReference: d.legalReviewReference,
  };
}

/** Stable comparison key for dirty detection; tolerant of not-yet-valid numeric strings. */
export const draftKey = (d: SchemeDraft) => JSON.stringify(d);

export function compatibleTree(t: ManagedTree, d: { farmId: string | null; species: string; variety: string }) {
  return !!d.farmId && t.farmId === d.farmId && t.species === d.species && !!d.variety.trim()
    && t.variety.trim().toLowerCase() === d.variety.trim().toLowerCase() && t.status !== 'archived';
}

export function taxPaise(feePaise: number, taxBps: number) {
  return Math.round((feePaise * taxBps) / 10000);
}

export function entitlementText(c: SchemeConfiguration) {
  switch (c.allocationType) {
    case 'fixed-quantity': return c.quantity ? `${c.quantity} ${c.unit === 'kg' ? 'kg' : 'fruit (count)'} per adopter, rounded ${c.roundingRule}` : 'Quantity not set';
    case 'harvest-share': return `${c.sharePercent}% of the measured harvest, up to ${c.maxAdopters} adopter${c.maxAdopters === 1 ? '' : 's'}, rounded ${c.roundingRule}`;
    case 'exclusive-harvest': return '100% of the measured harvest for a single adopter';
    case 'sale-proceeds': return `${c.sharePercent}% of actual net sale proceeds, settled after sale`;
  }
}

/** Terms a reviewer would expect before anything commercial; drafts may leave them blank. */
export function missingTerms(c: SchemeConfiguration) {
  const req: [keyof SchemeConfiguration, string][] = [['variety', 'Variety'], ['risks', 'Risks'], ['shortfallPolicy', 'Shortfall policy'],
    ['cancellationPolicy', 'Cancellation policy'], ['fulfilmentPolicy', 'Fulfilment policy'], ['agreementVersion', 'Agreement version'],
    ['terms', 'Agreement terms'], ['legalReviewReference', 'Commercial / legal review reference']];
  const out = req.filter(([k]) => !String(c[k] ?? '').trim()).map(([, l]) => l);
  if (!c.farmId) out.unshift('Farm');
  if (c.treeIds.length === 0) out.push('Trees');
  if (c.fulfilmentMethods.includes('delivery') && !c.deliveryRegions.trim()) out.push('Delivery regions');
  return out;
}

export function useSchemeCache() {
  const qc = useQueryClient();
  return async (saved: ManagedScheme) => {
    qc.setQueryData(getGetManagedSchemeQueryKey(saved.id), saved);
    await Promise.all([
      qc.invalidateQueries({ queryKey: getListManagedSchemesQueryKey() }),
      qc.invalidateQueries({ queryKey: getListSchemeRevisionsQueryKey(saved.id) }),
      qc.invalidateQueries({ queryKey: getGetWorkspaceSummaryQueryKey() }),
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/workspace/') && (q.queryKey[0] as string).includes('records') }),
    ]);
  };
}
