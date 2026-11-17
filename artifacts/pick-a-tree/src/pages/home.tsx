import { useRef } from 'react';
import { Link } from 'wouter';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BookOpenCheck, ClipboardCheck, Fingerprint, Scale, ShieldCheck, Sprout } from 'lucide-react';
import { useGetReadiness } from '@workspace/api-client-react';
import { IMAGES, SPECIES, useSeo } from '@/lib/brand';
import { Eyebrow, IllustrativeImage, Reveal, Section } from '@/components/site/bits';
import { Skeleton } from '@/components/ui/skeleton';

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const words = ['Your Tree.', 'Your Harvest.', 'Your Nature.'];

  return (
    <section ref={ref} className="relative -mt-[72px] min-h-[100dvh] overflow-hidden bg-emerald">
      <motion.div style={{ y }} className="absolute inset-0">
        <img src={IMAGES.heroOrchard} alt="Illustrative mango orchard at golden hour" className="animate-slowzoom h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(160_62%_8%/0.55)] via-[hsl(160_62%_10%/0.25)] to-[hsl(160_62%_9%/0.92)]" />
      </motion.div>
      <motion.div style={{ opacity: fade }} className="relative z-10 mx-auto flex min-h-[100dvh] max-w-7xl flex-col justify-end px-5 pb-14 pt-32 md:px-8 md:pb-20">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="eyebrow mb-6 text-ivory/80">
          Madurai – Dindigul · Tamil Nadu · Prelaunch
        </motion.p>
        <h1 className="font-display text-[3.2rem] font-light leading-[0.95] text-ivory sm:text-7xl md:text-[7.5rem] lg:text-[8.75rem]">
          {words.map((w, i) => (
            <motion.span key={w} className="block" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.18, duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}>
              {i === 1 ? <em className="text-harvest">{w}</em> : w}
            </motion.span>
          ))}
        </h1>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.8 }}
          className="mt-10 grid gap-8 border-t border-ivory/20 pt-8 md:grid-cols-12">
          <p className="text-lg leading-relaxed text-ivory/85 md:col-span-6 md:text-xl">
            Adopt one real, identified mango, guava or coconut tree on a verified Tamil Nadu farm. Follow its season through an honest Tree Passport. Receive a harvest share measured on a scale, not promised in a brochure.
          </p>
          <div className="flex flex-wrap items-start gap-3 md:col-span-6 md:justify-end">
            <Link href="/adopt" className="group inline-flex items-center gap-2 rounded-full bg-harvest px-7 py-4 font-semibold text-ivory transition-transform hover:-translate-y-0.5" data-testid="link-hero-adopt">
              Explore the catalogue <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-full border border-ivory/35 px-7 py-4 font-semibold text-ivory backdrop-blur-sm hover:bg-ivory/10" data-testid="link-hero-how">
              How it works
            </Link>
          </div>
        </motion.div>
        <p className="mt-8 text-[11px] text-ivory/55">Illustrative imagery — not a registered PICK A TREE farm or tree</p>
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

function ReadinessBand() {
  const { data, isLoading } = useGetReadiness();
  return (
    <Section className="py-14 md:py-16">
      <div className="grid gap-8 rounded-[2rem] bg-card p-7 shadow-md md:grid-cols-12 md:p-10" data-testid="panel-readiness">
        <div className="md:col-span-5">
          <Eyebrow>Where we are, honestly</Eyebrow>
          <h2 className="mt-4 text-3xl font-light text-emerald md:text-4xl">
            Adoptions are <span className="italic text-harvest">{isLoading ? '…' : data?.adoptionsOpen ? 'open' : 'not yet open'}</span>.
          </h2>
          {isLoading ? <Skeleton className="mt-4 h-12 w-full" /> : <p className="mt-4 text-muted-foreground" data-testid="text-readiness-message">{data?.message ?? 'Readiness status is unavailable right now.'}</p>}
        </div>
        <div className="md:col-span-7">
          <p className="eyebrow mb-4 text-muted-foreground">Gates that must close before the first adoption</p>
          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
          ) : (
            <ol className="space-y-2">
              {(data?.gates ?? []).map((g, i) => (
                <li key={g} className="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3" data-testid={`text-gate-${i}`}>
                  <span className="font-mono text-xs text-harvest">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[15px]">{g}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Section>
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
        <Reveal delay={0.1}><p className="max-w-sm text-muted-foreground">Verified listings for each species appear only after physical inspection. Availability: coming soon.</p></Reveal>
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
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-ivory/60">{s.season} · Availability coming soon</p>
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
          <p className="mt-5 text-ivory/80">We start where we can visit every tree. Farm partners are listed publicly only once their authority and agreements are verified.</p>
          <Link href="/farms" className="mt-7 inline-flex items-center gap-2 rounded-full bg-ivory px-6 py-3 font-semibold text-emerald" data-testid="link-region-farms">Our farm standard <ArrowRight className="h-4 w-4" /></Link>
        </Reveal>
      </div>
    </section>
  );
}

function Doors() {
  const doors = [
    { href: '/tree-passport', icon: BookOpenCheck, t: 'Tree Passport', d: 'What your private tree record will show.' },
    { href: '/nourish', icon: Sprout, t: 'Nourish', d: 'Optional, expert-approved extra care. Never a condition.' },
    { href: '/gift', icon: ArrowUpRight, t: 'Gift a tree', d: 'Weddings, birthdays, remembrance. Enquiries open now.' },
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
          <h2 className="relative max-w-3xl font-display text-4xl font-light leading-tight md:text-6xl">Be told first when the first verified tree is ready.</h2>
          <p className="relative mt-5 max-w-xl text-ivory/85">Leave an adoption enquiry now. Mobile-number sign-in is being connected. No payment is taken during prelaunch.</p>
          <div className="relative mt-9 flex flex-wrap gap-3">
            <Link href="/sign-in" className="rounded-full bg-emerald px-7 py-4 font-semibold" data-testid="link-cta-signup">Mobile sign-in</Link>
            <Link href="/contact" className="rounded-full border border-ivory/50 px-7 py-4 font-semibold hover:bg-ivory/10" data-testid="link-cta-contact">Leave an enquiry</Link>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

export default function HomePage() {
  useSeo('PICK A TREE — Your Tree. Your Harvest. Your Nature.', 'Adopt a real, inspected mango, guava or coconut tree in the Madurai–Dindigul region of Tamil Nadu, and follow honest, measured harvest records.');
  return (
    <>
      <Hero />
      <Marquee />
      <ReadinessBand />
      <Species />
      <Journey />
      <Promises />
      <Region />
      <Doors />
      <FinalCta />
    </>
  );
}
