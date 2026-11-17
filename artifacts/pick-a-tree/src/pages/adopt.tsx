import { useEffect, useState } from 'react';
import { Link, useParams, useSearch } from 'wouter';
import { ArrowLeft, ArrowRight, CalendarCheck, Leaf, MapPin, Search, Sprout, TreeDeciduous } from 'lucide-react';
import { getGetPublicTreeQueryKey, useGetPublicTree, useGetReadiness, useListPublicTrees } from '@workspace/api-client-react';
import { errorMessage, errorStatus, formatDate, formatPaise, IMAGES, SPECIES, useSeo } from '@/lib/brand';
import { EmptyState, ErrorState, Eyebrow, IllustrativeImage, PageHero, PrelaunchNotice, Reveal, Section, StatusPill } from '@/components/site/bits';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

export function AdoptPage() {
  useSeo('Adopt a Tree', 'Browse inspected and approved productive trees available for adoption in the Madurai–Dindigul region.');
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
      <PageHero eyebrow="Adoption catalogue" title={<>Every tree here was <em className="text-harvest">walked to</em>.</>}
        lede="Only trees that staff have registered, physically inspected and approved appear below. If the list is short or empty, that is the system working as intended." />
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
                    {t.image ? <img src={t.image} alt={t.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : (
                      <div className="flex h-full items-center justify-center"><TreeDeciduous className="h-16 w-16 text-leaf/50" strokeWidth={1} /></div>
                    )}
                    <div className="absolute left-3 top-3"><StatusPill status={t.status} className="bg-card/90" /></div>
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
            title={filtered ? 'No verified trees match yet.' : 'The catalogue is honestly empty — for now.'}
            body={filtered
              ? `No approved ${species || ''} trees match this search. Listings appear only after inspection and approval.`
              : 'Our team is inspecting candidate trees in the Madurai–Dindigul belt. Nothing is listed until it has a permanent identity, a dated inspection and an approved scheme.'}>
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
  const { data, isLoading, isError, error, refetch } = useGetPublicTree(id, { query: { enabled: !!id, queryKey: getGetPublicTreeQueryKey(id) } });
  const { data: readiness } = useGetReadiness();
  useSeo(data ? `${data.tree.name} (${data.tree.treeCode})` : 'Tree detail', data ? `${data.tree.species} · ${data.tree.variety} at ${data.tree.farmName}. Inspection, scheme and disclosures.` : 'Verified tree listing on PICK A TREE.');

  if (isLoading) return <Section><Skeleton className="h-10 w-48" /><div className="mt-8 grid gap-10 lg:grid-cols-2"><Skeleton className="aspect-square rounded-[2rem]" /><div className="space-y-4"><Skeleton className="h-14 w-3/4" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div></div></Section>;
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
  const facts = [
    ['Species', tree.species], ['Variety', tree.variety], ['Farm', tree.farmName], ['Zone', tree.zone],
    ['Estimated age', tree.age ?? 'Not recorded'], ['Last inspected', formatDate(tree.inspectedAt)],
  ];

  return (
    <>
      <Section className="pb-8 pt-10">
        <Link href="/adopt" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-emerald" data-testid="link-back"><ArrowLeft className="h-4 w-4" /> Catalogue</Link>
        <div className="mt-8 grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            {tree.image ? <img src={tree.image} alt={tree.name} className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-xl" data-testid="img-tree" /> : (
              <IllustrativeImage src={SPECIES.find((s) => s.key === tree.species)?.image ?? IMAGES.heroOrchard} alt="Illustrative species image" className="aspect-[4/5] rounded-[2rem] shadow-xl" />
            )}
          </div>
          <div className="lg:col-span-6">
            <div className="flex flex-wrap items-center gap-3"><span className="font-mono text-sm text-harvest" data-testid="text-tree-code">{tree.treeCode}</span><StatusPill status={tree.status} /></div>
            <h1 className="mt-4 text-5xl font-light leading-none text-emerald md:text-6xl" data-testid="text-tree-name">{tree.name}</h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{tree.description}</p>
            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
              {facts.map(([k, v]) => (
                <div key={k} className="bg-card p-4"><dt className="eyebrow text-[10px] text-muted-foreground">{k}</dt><dd className="mt-1.5 font-medium">{v}</dd></div>
              ))}
            </dl>
            {tree.productiveAssessment && (
              <div className="mt-6 rounded-2xl bg-secondary/70 p-5">
                <p className="flex items-center gap-2 font-semibold text-emerald"><Leaf className="h-4 w-4" /> Productive-stage assessment</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">{tree.productiveAssessment}</p>
              </div>
            )}
          </div>
        </div>
      </Section>
      <Section className="pt-8">
        <Eyebrow>Adoption schemes</Eyebrow>
        <h2 className="mt-4 text-4xl font-light text-emerald">Read everything before anything.</h2>
        {schemes.length === 0 ? (
          <EmptyState className="mt-8" icon={<CalendarCheck className="h-6 w-6" />} title="No approved scheme yet." body="This tree is verified, but its scheme terms are still under review. Nothing can be reserved until a versioned scheme is approved." />
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
              </div>
            ))}
          </div>
        )}
        <div className="mt-8">
          <PrelaunchNotice>
            <strong>Reservation and payment are not available.</strong> {readiness?.message ?? 'Adoptions open only after payment, agreements and approvals are in place.'} You can register interest and we will contact you when this tree can be reserved.
            <div className="mt-3"><Link href="/contact" className="font-semibold underline underline-offset-4" data-testid="link-register-interest">Register interest in this tree</Link></div>
          </PrelaunchNotice>
        </div>
      </Section>
    </>
  );
}
