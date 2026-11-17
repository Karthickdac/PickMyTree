import { useEffect, useState } from 'react';
import { Link, useParams, useSearch } from 'wouter';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarCheck, Leaf, MapPin, Search, Sprout, TreeDeciduous } from 'lucide-react';
import { getGetAdoptionCheckoutQueryKey, getGetPublicTreeQueryKey, useGetAdoptionCheckout, useGetPublicTree, useListPublicTrees, type CatalogueImage } from '@workspace/api-client-react';
import { errorMessage, errorStatus, formatDate, formatPaise, IMAGES, SPECIES, useSeo } from '@/lib/brand';
import { AvailabilityNote, EmptyState, ErrorState, Eyebrow, IllustrativeImage, PageHero, Reveal, SampleBadge, Section, StatusPill } from '@/components/site/bits';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

export function AdoptPage() {
  useSeo('Adopt a Tree', 'Explore tree profiles, farms and growing seasons in the Madurai–Dindigul region.');
  const search = useSearch();
  const initialSpecies = new URLSearchParams(search).get('species') ?? '';
  const [species, setSpecies] = useState(initialSpecies);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { setSpecies(initialSpecies); }, [initialSpecies]);
  useEffect(() => { const t = setTimeout(() => setDebounced(text.trim()), 300); return () => clearTimeout(t); }, [text]);

  const params = { ...(debounced ? { search: debounced } : {}), ...(species ? { species } : {}) };
  const { data: trees, isLoading, isError, error, refetch } = useListPublicTrees(params);
  const filtered = !!(debounced || species);

  return (
    <>
      <PageHero eyebrow="Tree catalogue" title={<>Find your tree. <em className="text-harvest">Follow its story</em>.</>}
        lede="Explore mango, guava and coconut trees by farm and variety. Each profile shows its details and availability." />
      <Section className="pt-10">
        <div className="sticky top-[72px] z-20 -mx-5 mb-10 flex flex-col gap-3 bg-background/90 px-5 py-4 backdrop-blur-md md:mx-0 md:flex-row md:items-center md:rounded-full md:border md:border-border md:px-3 md:py-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by tree code, variety or farm" className="h-12 rounded-full border-0 bg-card pl-11 shadow-none md:bg-transparent" data-testid="input-search-trees" />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {['', ...SPECIES.map((s) => s.key)].map((s) => (
              <button key={s || 'all'} type="button" onClick={() => setSpecies(s)} data-testid={`button-filter-${s || 'all'}`}
                className={cn('shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-colors', species === s ? 'bg-emerald text-ivory' : 'bg-card text-foreground/75 hover:bg-secondary')}>
                {s || 'All species'}
              </button>
            ))}
          </div>
        </div>

        {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="space-y-3"><Skeleton className="aspect-[4/3] rounded-[1.5rem]" /><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>)}
          </div>
        ) : trees && trees.length > 0 ? (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {trees.map((t, i) => (
              <Reveal key={t.id} delay={(i % 3) * 0.06}>
                <Link href={`/adopt/${t.id}`} className="group block" data-testid={`card-tree-${t.id}`}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-secondary">
                    {(t.images?.[0]?.url ?? t.image) ? <img src={t.images?.[0]?.url ?? t.image} alt={t.images?.[0]?.name ?? t.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : (
                      <div className="flex h-full items-center justify-center"><TreeDeciduous className="h-16 w-16 text-leaf/50" strokeWidth={1} /></div>
                    )}
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2"><StatusPill status={t.status} className="bg-card/90" />{t.isSample && <SampleBadge className="bg-card/90" />}</div>
                    {t.images?.[0]?.isIllustrative && <span className="absolute bottom-3 left-3 rounded-full bg-card/85 px-2 py-0.5 text-[10px] text-soil">Species image</span>}
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-harvest">{t.treeCode}</p>
                      <h3 className="mt-1 font-display text-2xl text-emerald">{t.name}</h3>
                      <p className="text-sm text-muted-foreground">{t.species} · {t.variety}</p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{t.farmName} · {t.zone}</p>
                    </div>
                    <ArrowRight className="mt-6 h-5 w-5 text-emerald transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Sprout className="h-6 w-6" />}
            title={filtered ? 'No verified trees match yet.' : 'No trees are listed right now.'}
            body={filtered
              ? `No approved ${species || ''} trees match this search. Listings appear only after inspection and approval.`
              : 'Trees appear here as farm managers list them. Check back soon, or tell us what you are looking for.'}>
            {filtered && <button type="button" onClick={() => { setSpecies(''); setText(''); }} className="rounded-full border border-emerald px-5 py-2.5 text-sm font-semibold text-emerald" data-testid="button-clear-filters">Clear filters</button>}
            <Link href="/contact" className="rounded-full bg-harvest px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="link-empty-enquire">Register adoption interest</Link>
          </EmptyState>
        )}
      </Section>
    </>
  );
}

export function TreeDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useGetPublicTree(id, { query: { enabled: !!id, queryKey: getGetPublicTreeQueryKey(id), staleTime: 15000, refetchInterval: 30000 } });
  const checkout = useGetAdoptionCheckout(id, { query: { enabled: !!id, retry: false, queryKey: getGetAdoptionCheckoutQueryKey(id) } });
  useSeo(data ? `${data.tree.name} (${data.tree.treeCode})` : 'Tree detail', data ? `${data.tree.species} · ${data.tree.variety} at ${data.tree.farmName}. Inspection, scheme and disclosures.` : 'Verified tree listing on Pick My Tree.');

  if (isLoading) return <Section><Skeleton className="h-6 w-32" /><div className="mt-6 grid items-start gap-6 md:grid-cols-[280px_minmax(0,1fr)]"><Skeleton className="h-52 w-full rounded-2xl" /><div className="space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-16 w-full" /><Skeleton className="h-32 w-full" /></div></div></Section>;
  if (isError || !data) {
    return (
      <Section>
        {errorStatus(error) === 404 || !data && !isError ? (
          <EmptyState icon={<TreeDeciduous className="h-6 w-6" />} title="This tree is not publicly listed." body="It may have been reserved, paused for inspection, or never approved. Only verified trees have public pages.">
            <Link href="/adopt" className="rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="link-back-catalogue">Back to catalogue</Link>
          </EmptyState>
        ) : <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />}
      </Section>
    );
  }
  const { tree, schemes } = data;
  const co = checkout.data;
  const canAdopt = !!co && co.offers.length > 0 && !!co.tree.adoptionEligible && co.payment.acceptingPayments && co.blockers.length === 0;
  const offerFor = (schemeId: string) => co?.offers.find((o) => o.schemeId === schemeId);
  const blockers = co ? (co.blockers.length ? co.blockers : [
    ...(co.offers.length ? [] : ['No approved scheme is attached to this tree yet.']),
    ...(co.tree.adoptionEligible ? [] : ['This tree has not been approved for adoption yet.']),
    ...(co.payment.acceptingPayments ? [] : ['Online payments are not being accepted yet.']),
  ]) : [];
  const facts = [
    ['Species', tree.species], ['Variety', tree.variety], ['Farm', tree.farmName], ['Zone', tree.zone],
    ['Estimated age', tree.age ?? 'Not recorded'], ['Last inspected', formatDate(tree.inspectedAt)],
  ];

  return (
    <>
      <Section className="pb-6 pt-6 md:pb-6 md:pt-6">
        <Link href="/adopt" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-emerald" data-testid="link-back"><ArrowLeft className="h-4 w-4" /> Catalogue</Link>
        <div className="mt-6 grid items-start gap-6 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8">
          <div className="w-full max-w-sm">
            <TreeGallery images={tree.images ?? []} fallback={tree.image} name={tree.name} species={tree.species} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3"><span className="font-mono text-sm text-harvest" data-testid="text-tree-code">{tree.treeCode}</span><StatusPill status={tree.status} />{tree.isSample && <SampleBadge />}</div>
            <h1 className="mt-3 text-3xl font-light leading-tight text-emerald lg:text-4xl" data-testid="text-tree-name">{tree.name}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{tree.description}</p>
            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
              {facts.map(([k, v]) => (
                <div key={k} className="bg-card p-3"><dt className="eyebrow text-[10px] text-muted-foreground">{k}</dt><dd className="mt-1 text-sm font-medium">{v}</dd></div>
              ))}
            </dl>
            {tree.productiveAssessment && (
              <div className="mt-4 rounded-2xl bg-secondary/70 p-4">
                <p className="flex items-center gap-2 font-semibold text-emerald"><Leaf className="h-4 w-4" /> Productive-stage assessment</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">{tree.productiveAssessment}</p>
              </div>
            )}
          </div>
        </div>
      </Section>
      <Section className="pb-10 pt-4 md:pb-12 md:pt-4">
        <Eyebrow>Adoption schemes</Eyebrow>
        <h2 className="mt-2 text-2xl font-light text-emerald md:text-3xl">Choose your harvest scheme</h2>
        {schemes.length === 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-card p-4"><CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-leaf" /><div><p className="font-medium text-emerald">No schemes published for this tree</p><p className="mt-1 text-sm text-muted-foreground">Current status is shown below.</p></div></div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {schemes.map((s) => (
              <div key={s.id} className="rounded-[1.75rem] border border-border bg-card p-7" data-testid={`card-scheme-${s.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="font-display text-2xl text-emerald">{s.name}</h3><p className="font-mono text-xs text-muted-foreground">Version {s.version} · {s.durationMonths} months</p></div>
                  <p className="font-display text-3xl text-harvest" data-testid={`text-fee-${s.id}`}>{formatPaise(s.feePaise)}</p>
                </div>
                <p className="mt-5 eyebrow text-[10px] text-muted-foreground">Entitlement</p>
                <p className="mt-1 leading-relaxed">{s.entitlement}</p>
                <Accordion type="single" collapsible className="mt-4">
                  <AccordionItem value="d" className="border-border">
                    <AccordionTrigger className="text-sm font-semibold" data-testid={`button-disclosures-${s.id}`}>Disclosures and risks</AccordionTrigger>
                    <AccordionContent className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{s.disclosures}</AccordionContent>
                  </AccordionItem>
                </Accordion>
                {canAdopt && offerFor(s.id) && <Link href={`/checkout/${tree.id}?offer=${offerFor(s.id)!.id}`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-harvest px-5 py-2.5 text-sm font-semibold text-ivory" data-testid={`link-adopt-${s.id}`}>Review & adopt <ArrowRight className="h-4 w-4" /></Link>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <AvailabilityNote>
            <div data-testid="text-adoption-availability">{checkout.isLoading ? <span>Checking current adoption status.</span>
              : checkout.isError ? <span>Adoption status could not be loaded. <button type="button" onClick={() => checkout.refetch()} className="font-semibold underline">Retry</button></span>
              : canAdopt ? <span><strong>Open for adoption.</strong> Choose a scheme above to review the full agreement and total.{co!.payment.mode === 'test' && ' Payments currently run in a non-live environment; no real money is collected.'}</span>
              : <><strong>Online adoption is not open for this tree.</strong><ul className="mt-2 space-y-1">{blockers.map((b) => <li key={b} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{b}</li>)}</ul></>}</div>
            {!canAdopt && <div className="mt-3"><Link href="/contact" className="font-semibold underline underline-offset-4" data-testid="link-register-interest">Ask about this tree</Link></div>}
          </AvailabilityNote>
        </div>
      </Section>
    </>
  );
}

function TreeGallery({ images, fallback, name, species }: { images: CatalogueImage[]; fallback?: string; name: string; species: string }) {
  const [active, setActive] = useState(0);
  const current = images[Math.min(active, images.length - 1)];
  if (!current) {
    return fallback
      ? <img src={fallback} alt={name} className="h-48 w-full rounded-2xl object-cover shadow-sm sm:h-56 lg:h-60" data-testid="img-tree" />
      : <IllustrativeImage src={SPECIES.find((s) => s.key === species)?.image ?? IMAGES.heroOrchard} alt="Species imagery" className="h-48 rounded-2xl shadow-sm sm:h-56 lg:h-60" />;
  }
  return (
    <div>
      <div className="relative">
        <img src={current.url} alt={current.name} className="h-48 w-full rounded-2xl object-cover shadow-sm sm:h-56 lg:h-60" data-testid="img-tree" />
        {current.isIllustrative && <span className="absolute bottom-4 left-4 rounded-full bg-card/85 px-3 py-1 text-[11px] text-soil">Species image</span>}
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={i === active}
              className={cn('h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity', i === active ? 'border-harvest' : 'border-transparent opacity-70 hover:opacity-100')} data-testid={`button-photo-${i}`}>
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
