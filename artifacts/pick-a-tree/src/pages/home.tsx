import { useRef } from 'react';
import { Link } from 'wouter';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Gift, MapPin, Route, Tractor, TreeDeciduous } from 'lucide-react';
import { ArrowRight, ArrowUpRight, BookOpenCheck, ClipboardCheck, Fingerprint, Scale, ShieldCheck, Sprout } from 'lucide-react';
import { useListPublicFarms, useListPublicTrees } from '@workspace/api-client-react';
import { errorMessage, IMAGES, SPECIES, useSeo } from '@/lib/brand';
import { ErrorState, Eyebrow, IllustrativeImage, Reveal, SampleBadge, Section } from '@/components/site/bits';
import { Skeleton } from '@/components/ui/skeleton';

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const words = ['Your Tree.', 'Your Harvest.', 'Your Nature.'];

  return (
    <section ref={ref} className="relative min-h-[calc(100dvh-72px)] overflow-hidden bg-emerald">
      <motion.div style={{ y }} className="absolute inset-0">
        <img src={IMAGES.heroOrchard} alt="Illustrative mango orchard at golden hour" className="animate-slowzoom h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(160_62%_8%/0.55)] via-[hsl(160_62%_10%/0.25)] to-[hsl(160_62%_9%/0.92)]" />
      </motion.div>
      <motion.div style={{ opacity: fade }} className="relative z-10 mx-auto flex min-h-[calc(100dvh-72px)] max-w-7xl flex-col justify-end px-5 pb-28 pt-16 md:px-8 md:pb-32">
        <motion.p initial={false} animate={{ opacity: 1 }} className="eyebrow mb-6 text-ivory/80">
          Individual tree adoption · Madurai – Dindigul, Tamil Nadu
        </motion.p>
        <h1 className="font-display text-[3rem] font-light leading-[0.95] text-ivory sm:text-7xl md:text-[6.5rem] lg:text-[7.5rem]">
          {words.map((w, i) => (
            <motion.span key={w} className="block" initial={false} animate={{ opacity: 1, y: 0 }}>
              {i === 1 ? <em className="text-harvest">{w}</em> : w}
            </motion.span>
          ))}
        </h1>
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}
          className="mt-10 grid gap-8 border-t border-ivory/20 pt-8 md:grid-cols-12">
          <p className="text-lg leading-relaxed text-ivory/85 md:col-span-6 md:text-xl">
            Choose one coded mango, guava or coconut tree on a registered Tamil Nadu farm. See its photos, its farm and its season, and check each tree's own availability.
          </p>
          <div className="flex flex-wrap items-start gap-3 md:col-span-6 md:justify-end">
            <Link href="/adopt" className="group inline-flex items-center gap-2 rounded-full bg-harvest px-7 py-4 font-semibold text-ivory transition-transform hover:-translate-y-0.5" data-testid="link-hero-adopt">
              Browse trees <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/farms" className="inline-flex items-center gap-2 rounded-full bg-ivory px-7 py-4 font-semibold text-emerald hover:bg-card" data-testid="link-hero-farms">
              See the farms
            </Link>
          </div>
        </motion.div>
        <p className="mt-8 text-[11px] text-ivory/55">Illustrative imagery — not a registered Pick My Tree farm or tree</p>
      </motion.div>
    </section>
  );
}

function Marquee() {
  const items = ['ADOPT', 'GROW', 'HARVEST', 'மா', 'கொய்யா', 'தென்னை', 'MEASURED', 'NOT PROMISED'];
  return (
    <div className="overflow-hidden border-y border-emerald/10 bg-ivory py-5">
      <div className="animate-marquee flex w-max gap-12 whitespace-nowrap">
        {[...items, ...items, ...items, ...items].map((t, i) => (
          <span key={i} className="flex items-center gap-12 font-display text-3xl font-light text-emerald/80 md:text-4xl">
            {t}<span className="h-2 w-2 rounded-full bg-harvest" />
          </span>
        ))}
      </div>
    </div>
  );
}

function LiveCatalogue() {
  const farms = useListPublicFarms();
  const trees = useListPublicTrees({});
  const farm = farms.data?.[0];
  const list = (trees.data ?? []).slice(0, 4);
  const anySample = !!farm?.isSample || list.some((t) => t.isSample);
  return (
    <Section className="py-16 md:py-24">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <Reveal>
          <Eyebrow>On the farm now</Eyebrow>
          <h2 className="mt-4 max-w-3xl text-4xl font-light leading-tight text-emerald md:text-6xl">Meet a registered farm, <em className="text-harvest">tree by tree</em>.</h2>
        </Reveal>
        <Reveal delay={0.1} className="max-w-sm">
          <p className="text-muted-foreground">Every tree below carries its own permanent code. {anySample && 'Listings marked Sample data are test records that show how the catalogue works and cannot be adopted.'}</p>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          {farms.isLoading ? <Skeleton className="h-[520px] rounded-[2rem]" /> : farms.isError ? (
            <ErrorState message={errorMessage(farms.error)} onRetry={() => farms.refetch()} />
          ) : farm ? (
            <Link href="/farms" className="group relative block h-full min-h-[460px] overflow-hidden rounded-[2rem] bg-emerald text-ivory" data-testid={`card-home-farm-${farm.id}`}>
              <img src={farm.images?.[0]?.url ?? farm.image ?? IMAGES.farmLandscape} alt={farm.images?.[0]?.name ?? farm.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[hsl(160_62%_8%/0.95)] via-[hsl(160_62%_8%/0.35)] to-transparent" />
              <div className="absolute left-5 top-5 flex gap-2"><span className="rounded-full bg-ivory px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald">Farm</span>{farm.isSample && <SampleBadge className="bg-card/90" />}</div>
              <div className="absolute inset-x-0 bottom-0 p-7">
                <p className="flex items-center gap-1.5 text-sm text-ivory/75"><MapPin className="h-4 w-4" />{farm.location ? `${farm.location}, ` : ''}{farm.district}</p>
                <h3 className="mt-2 font-display text-4xl font-light md:text-5xl">{farm.name}</h3>
                <p className="mt-3 line-clamp-3 text-ivory/80">{farm.description}</p>
                <div className="mt-5 flex flex-wrap items-center gap-4 font-mono text-xs text-ivory/70">
                  {farm.areaAcres !== undefined && <span>{farm.areaAcres} acres</span>}
                  {farm.treeCount !== undefined && <span>{farm.treeCount} listed trees</span>}
                  <span className="ml-auto inline-flex items-center gap-1.5 font-sans text-sm font-semibold text-harvest">All farms <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex h-full min-h-[300px] flex-col justify-end rounded-[2rem] bg-secondary p-8"><h3 className="font-display text-3xl text-emerald">No farm is listed right now.</h3><Link href="/farms" className="mt-4 font-semibold text-harvest">See the farm standard</Link></div>
          )}
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
          {trees.isLoading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-[1.5rem]" />) : trees.isError ? (
            <div className="sm:col-span-2"><ErrorState message={errorMessage(trees.error)} onRetry={() => trees.refetch()} /></div>
          ) : list.length === 0 ? (
            <div className="rounded-[1.5rem] border border-border bg-card p-8 sm:col-span-2"><p className="font-display text-2xl text-emerald">No trees are listed right now.</p><p className="mt-2 text-muted-foreground">Trees appear as soon as a farm manager lists them.</p></div>
          ) : list.map((t, i) => (
            <Reveal key={t.id} delay={i * 0.07}>
              <Link href={`/adopt/${t.id}`} className="group block overflow-hidden rounded-[1.5rem] border border-border bg-card transition-all hover:-translate-y-1 hover:border-leaf hover:shadow-lg" data-testid={`card-home-tree-${t.id}`}>
                <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
                  {(t.images?.[0]?.url ?? t.image) ? <img src={t.images?.[0]?.url ?? t.image} alt={t.images?.[0]?.name ?? t.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    : <img src={SPECIES.find((s) => s.key === t.species)?.image ?? IMAGES.heroOrchard} alt="Illustrative species image" className="h-full w-full object-cover opacity-80" />}
                  {t.isSample && <SampleBadge className="absolute left-3 top-3 bg-card/90" />}
                </div>
                <div className="flex items-end justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-harvest">{t.treeCode}</p>
                    <h3 className="mt-1 truncate font-display text-2xl text-emerald">{t.name}</h3>
                    <p className="truncate text-sm text-muted-foreground">{t.species} · {t.variety}</p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 shrink-0 text-emerald transition-transform group-hover:rotate-45" />
                </div>
              </Link>
            </Reveal>
          ))}
          <Link href="/adopt" className="group flex items-center justify-between rounded-[1.5rem] bg-emerald px-6 py-5 font-semibold text-ivory sm:col-span-2" data-testid="link-home-all-trees">
            Browse the full tree catalogue <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </Section>
  );
}

function QuickMenu() {
  const items = [
    { href: '/adopt', icon: TreeDeciduous, t: 'Trees', d: 'Browse individually coded trees' },
    { href: '/farms', icon: Tractor, t: 'Farms', d: 'Where each tree grows' },
    { href: '/how-it-works', icon: Route, t: 'How it works', d: 'Adopt, grow, harvest' },
    { href: '/gift', icon: Gift, t: 'Gift a tree', d: 'Weddings, birthdays, remembrance' },
  ];
  return (
    <div className="relative z-20 mx-auto -mt-16 max-w-7xl px-5 md:-mt-20 md:px-8">
      <nav aria-label="Explore" className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.75rem] border border-border bg-border shadow-xl md:grid-cols-4">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="group flex flex-col gap-3 bg-card p-5 transition-colors hover:bg-secondary md:flex-row md:items-center md:p-6" data-testid={`link-quick-${it.href.slice(1)}`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald text-ivory transition-transform group-hover:scale-110"><it.icon className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="flex items-center gap-1 font-display text-xl text-emerald">{it.t}<ArrowRight className="h-4 w-4 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" /></span><span className="block text-sm text-muted-foreground">{it.d}</span></span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function Species() {
  return (
    <Section>
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <Reveal>
          <Eyebrow>Three trees to begin with</Eyebrow>
          <h2 className="mt-4 max-w-3xl text-4xl font-light leading-tight text-emerald md:text-6xl">Choose the tree whose rhythm suits your family.</h2>
        </Reveal>
        <Reveal delay={0.1}><p className="max-w-sm text-muted-foreground">Each species links straight to its listed trees. Every tree page states its own availability.</p></Reveal>
      </div>
      <div className="mt-14 grid gap-6 md:grid-cols-12">
        {SPECIES.map((s, i) => (
          <Reveal key={s.key} delay={i * 0.1} className={i === 0 ? 'md:col-span-6 md:row-span-2' : 'md:col-span-6'}>
            <Link href={`/adopt?species=${s.key}`} className="group block h-full" data-testid={`link-species-${s.key.toLowerCase()}`}>
              <div className="relative h-full overflow-hidden rounded-[2rem] bg-emerald">
                <IllustrativeImage src={s.image} alt={`Illustrative ${s.key} tree`} labelPosition="top-left"
                  className={i === 0 ? 'aspect-[4/5] md:aspect-auto md:h-full md:min-h-[640px]' : 'aspect-[16/10]'}
                  imgClassName="transition-transform duration-[1.2s] group-hover:scale-105" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(160_62%_8%/0.9)] via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-ivory md:p-8">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-display text-lg text-harvest">{s.tamil}</p>
                      <h3 className="font-display text-4xl font-light md:text-5xl">{s.key}</h3>
                    </div>
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ivory text-emerald transition-transform group-hover:rotate-45"><ArrowUpRight className="h-5 w-5" /></span>
                  </div>
                  <p className="mt-3 max-w-md text-sm text-ivory/80">{s.line}</p>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-ivory/60">{s.season} · See listed trees</p>
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Journey() {
  const steps = [
    { n: '01', t: 'Adopt', d: 'Choose a specific registered tree. Read its scheme, every disclosure and the exact entitlement before you pay a rupee.' },
    { n: '02', t: 'Grow', d: 'Field teams record care with timestamped, moderated evidence in your private Tree Passport. No staged photos.' },
    { n: '03', t: 'Harvest', d: 'Fruit is weighed or counted, losses recorded, and your share reconciled against the scheme version you accepted.' },
  ];
  return (
    <section className="ring-lines relative overflow-hidden bg-emerald text-ivory">
      <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <Reveal>
          <p className="eyebrow text-harvest">ADOPT • GROW • HARVEST</p>
          <h2 className="mt-5 max-w-4xl text-4xl font-light leading-tight md:text-6xl">A season with one tree, recorded the way a farmer would want it recorded.</h2>
        </Reveal>
        <div className="mt-16 grid gap-px overflow-hidden rounded-[2rem] bg-ivory/15 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12} className="bg-emerald p-8 md:p-10">
              <span className="font-mono text-sm text-harvest">{s.n}</span>
              <h3 className="mt-8 font-display text-5xl font-light">{s.t}</h3>
              <p className="mt-4 leading-relaxed text-ivory/75">{s.d}</p>
            </Reveal>
          ))}
        </div>
        <Link href="/how-it-works" className="mt-10 inline-flex items-center gap-2 font-semibold text-harvest hover:underline" data-testid="link-journey-more">Read the full journey <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </section>
  );
}

function Promises() {
  const items = [
    { icon: Fingerprint, t: 'One tree, one identity', d: 'Every tree carries a permanent code and registration photo set before it can be listed.' },
    { icon: ClipboardCheck, t: 'Inspected, not assumed', d: 'Productive stage and condition are assessed in person and dated on the listing.' },
    { icon: Scale, t: 'Measured harvests', d: 'Estimates are labelled as estimates. Actual quantities, grades and losses are recorded separately.' },
    { icon: ShieldCheck, t: 'Not an investment', d: 'No returns, no title to land or tree, nothing to resell. A relationship with a tree, not a portfolio.' },
  ];
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <IllustrativeImage src={IMAGES.harvestHands} alt="Illustrative harvest basket and balance" className="aspect-[4/5] rounded-[2rem] shadow-xl" />
        </Reveal>
        <div className="lg:col-span-7 lg:pl-6">
          <Reveal>
            <Eyebrow>What we will and will not claim</Eyebrow>
            <h2 className="mt-4 text-4xl font-light leading-tight text-emerald md:text-5xl">Trust is built in kilograms and dates, not adjectives.</h2>
          </Reveal>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {items.map((it, i) => (
              <Reveal key={it.t} delay={i * 0.08}>
                <it.icon className="h-7 w-7 text-harvest" strokeWidth={1.5} />
                <h3 className="mt-4 font-display text-2xl text-emerald">{it.t}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{it.d}</p>
              </Reveal>
            ))}
          </div>
          <Link href="/transparency" className="mt-10 inline-flex items-center gap-2 rounded-full border border-emerald px-6 py-3 font-semibold text-emerald hover:bg-emerald hover:text-ivory" data-testid="link-transparency">Visit the Transparency Centre <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </Section>
  );
}

function Region() {
  return (
    <section className="relative">
      <IllustrativeImage src={IMAGES.farmLandscape} alt="Illustrative farm landscape between Madurai and Dindigul" className="h-[70vh] min-h-[460px]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[hsl(160_62%_8%/0.85)] via-[hsl(160_62%_8%/0.4)] to-transparent" />
      <div className="absolute inset-0 mx-auto flex max-w-7xl items-center px-5 md:px-8">
        <Reveal className="max-w-xl text-ivory">
          <p className="eyebrow text-harvest">The first region</p>
          <h2 className="mt-4 text-4xl font-light leading-tight md:text-6xl">Red soil, hill wind, and the Madurai–Dindigul orchard belt.</h2>
          <p className="mt-5 text-ivory/80">We start where we can visit every tree. Each farm page shows its trees, photos and a general location, never an exact address.</p>
          <Link href="/farms" className="mt-7 inline-flex items-center gap-2 rounded-full bg-ivory px-6 py-3 font-semibold text-emerald" data-testid="link-region-farms">Visit the farms <ArrowRight className="h-4 w-4" /></Link>
        </Reveal>
      </div>
    </section>
  );
}

function Doors() {
  const doors = [
    { href: '/tree-passport', icon: BookOpenCheck, t: 'Tree Passport', d: 'What your private tree record will show.' },
    { href: '/nourish', icon: Sprout, t: 'Nourish', d: 'Optional, expert-approved extra care. Never a condition.' },
    { href: '/gift', icon: ArrowUpRight, t: 'Gift a tree', d: 'Weddings, birthdays, remembrance.' },
  ];
  return (
    <Section>
      <div className="grid gap-4 md:grid-cols-3">
        {doors.map((d, i) => (
          <Reveal key={d.href} delay={i * 0.08}>
            <Link href={d.href} className="group flex h-full flex-col justify-between rounded-[1.75rem] border border-border bg-card p-8 transition-all hover:-translate-y-1 hover:border-leaf hover:shadow-lg" data-testid={`link-door-${d.href.slice(1)}`}>
              <d.icon className="h-7 w-7 text-leaf" strokeWidth={1.5} />
              <div className="mt-16">
                <h3 className="font-display text-3xl text-emerald">{d.t}</h3>
                <p className="mt-2 text-muted-foreground">{d.d}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-harvest">Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <Section className="pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-harvest px-7 py-16 text-ivory md:px-16 md:py-24">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border-[40px] border-ivory/10" />
          <h2 className="relative max-w-3xl font-display text-4xl font-light leading-tight md:text-6xl">Find the one tree that will be yours.</h2>
          <p className="relative mt-5 max-w-xl text-ivory/85">Browse listed trees, sign in with your mobile number, or ask us anything. Online checkout is not connected yet, and each tree states whether it can be reserved.</p>
          <div className="relative mt-9 flex flex-wrap gap-3">
            <Link href="/adopt" className="rounded-full bg-emerald px-7 py-4 font-semibold" data-testid="link-cta-trees">Browse trees</Link>
            <Link href="/sign-in" className="rounded-full bg-ivory px-7 py-4 font-semibold text-emerald" data-testid="link-cta-signup">Mobile sign-in</Link>
            <Link href="/contact" className="rounded-full border border-ivory/50 px-7 py-4 font-semibold hover:bg-ivory/10" data-testid="link-cta-contact">Leave an enquiry</Link>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

export default function HomePage() {
  useSeo('Pick My Tree — Your Tree. Your Harvest. Your Nature.', 'Adopt a real, inspected mango, guava or coconut tree in the Madurai–Dindigul region of Tamil Nadu, and follow honest, measured harvest records.');
  return (
    <>
      <Hero />
      <QuickMenu />
      <LiveCatalogue />
      <Marquee />
      <Species />
      <Journey />
      <Promises />
      <Region />
      <Doors />
      <FinalCta />
    </>
  );
}
