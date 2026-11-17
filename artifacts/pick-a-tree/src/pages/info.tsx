import { Link, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, BookOpen, Building2, Clock, FileWarning, Heart, Mail, MapPin, QrCode, Sprout, Tractor } from 'lucide-react';
import { useListArticles, useListPublicFarms } from '@workspace/api-client-react';
import { errorMessage, IMAGES, useSeo } from '@/lib/brand';
import { EmptyState, ErrorState, Eyebrow, IllustrativeImage, PageHero, PrelaunchNotice, Reveal, Section } from '@/components/site/bits';
import { EnquiryForm } from '@/components/site/enquiry-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

function Steps({ items }: { items: { t: string; d: string }[] }) {
  return (
    <ol className="relative border-l border-leaf/30 pl-8 md:pl-12">
      {items.map((s, i) => (
        <Reveal key={s.t} delay={i * 0.05}>
          <li className="relative pb-12 last:pb-0">
            <span className="absolute -left-[45px] flex h-9 w-9 items-center justify-center rounded-full bg-emerald font-mono text-xs text-ivory md:-left-[61px]">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="font-display text-3xl text-emerald">{s.t}</h3>
            <p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted-foreground">{s.d}</p>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}

export function HowItWorksPage() {
  useSeo('How it works', 'From choosing a verified tree to a measured, reconciled harvest share — the full PICK A TREE journey.');
  return (
    <>
      <PageHero eyebrow="ADOPT • GROW • HARVEST" title={<>From one tree to <em className="text-harvest">one honest harvest</em>.</>}
        lede="The whole journey, including the parts that are not yet live. We mark what is waiting on approvals so you never mistake a plan for a promise." image={IMAGES.mango} imageAlt="Illustrative mangoes" />
      <Section>
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-4"><Eyebrow>The journey</Eyebrow><h2 className="mt-4 text-4xl font-light text-emerald">Nine steps, each one recorded.</h2>
            <div className="mt-8"><PrelaunchNotice>Reservation, checkout and agreements are not yet active. They open only after verified inventory and a connected payment provider.</PrelaunchNotice></div>
          </div>
          <div className="lg:col-span-8">
            <Steps items={[
              { t: 'Discover a verified tree', d: 'Browse only trees that are registered, physically inspected and approved, each with a permanent code.' },
              { t: 'Compare schemes', d: 'Each scheme states term, fee, exact entitlement formula, deductions, risks and remedies — versioned, never edited after you accept.' },
              { t: 'Create a verified account', d: 'Your profile, delivery address and communication preferences in English or Tamil.' },
              { t: 'Reserve with a short hold', d: 'A time-limited hold prevents two families adopting the same exclusive tree.' },
              { t: 'Pay through an approved gateway', d: 'Itemised checkout, receipt and agreement. Not yet connected during prelaunch.' },
              { t: 'Open your Tree Passport', d: 'A private record of identity, inspections, care and moderated field updates.' },
              { t: 'Follow the season', d: 'Flowering, fruit set, care tasks and any weather events, logged by people on the farm.' },
              { t: 'Harvest, weighed and reconciled', d: 'Gross quantity, grades and losses recorded; your allocation calculated using your scheme version.' },
              { t: 'Pickup or delivery', d: 'Fulfilment and acceptance, with support if anything falls short.' },
            ]} />
          </div>
        </div>
      </Section>
    </>
  );
}

export function FarmsPage() {
  useSeo('Our farms', 'Farm partners in the Madurai–Dindigul region, listed only after their authority and agreements are verified.');
  const { data: farms, isLoading, isError, error, refetch } = useListPublicFarms();
  return (
    <>
      <PageHero eyebrow="Farm partners" title={<>A farm is listed when its <em className="text-harvest">paperwork is real</em>.</>}
        lede="Each partner farm needs verified owner or operator authority, a signed agreement and mapped zones before any of its trees can appear." image={IMAGES.farmLandscape} imageAlt="Illustrative farm landscape" />
      <Section>
        {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-72 rounded-[2rem]" />)}</div>
        ) : farms && farms.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2">
            {farms.map((f) => (
              <article key={f.id} className="overflow-hidden rounded-[2rem] border border-border bg-card" data-testid={`card-farm-${f.id}`}>
                {f.image && <img src={f.image} alt={f.name} className="aspect-[16/9] w-full object-cover" />}
                <div className="p-7">
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{f.district}</p>
                  <h3 className="mt-2 font-display text-3xl text-emerald">{f.name}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{f.description}</p>
                  {f.practices && f.practices.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{f.practices.map((p) => <span key={p} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-emerald">{p}</span>)}</div>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Tractor className="h-6 w-6" />} title="No farm is publicly listed yet." body="Conversations with orchard owners in the region are under way. We will not name a farm until its authority is verified and agreements are signed.">
            <Link href="/contact" className="rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="link-farm-partner">Own an orchard? Talk to us</Link>
          </EmptyState>
        )}
      </Section>
      <Section className="pt-0">
        <div className="grid gap-6 md:grid-cols-3">
          {[['Authority', 'Owner or operator documentation, agreement validity and expiry alerts.'], ['Mapping', 'Zones, rows and blocks, with protected GPS that is never published exactly.'], ['People', 'Named farm manager, emergency contacts and a scoped field team.']].map(([t, d]) => (
            <div key={t} className="rounded-[1.5rem] bg-secondary/60 p-7"><h3 className="font-display text-2xl text-emerald">{t}</h3><p className="mt-2 text-muted-foreground">{d}</p></div>
          ))}
        </div>
      </Section>
    </>
  );
}

export function PassportPage() {
  useSeo('Tree Passport', 'What the private Tree Passport records for every adopted PICK A TREE tree.');
  const rows = [
    ['Identity', 'Permanent tree code, species, variety, estimated age and registration photo set.'],
    ['Location', 'Farm and zone. Exact GPS is masked to protect the farm.'],
    ['Inspection', 'Dated condition and productive-stage assessments with the inspector role.'],
    ['Care log', 'Tasks and evidence with capture versus upload times, moderated before you see them.'],
    ['Season', 'Flowering, fruit set and readiness milestones, as they actually happen.'],
    ['Harvest', 'Measured quantities, grades, losses, and your reconciled allocation.'],
  ];
  return (
    <>
      <PageHero eyebrow="Tree Passport" title={<>A tree&rsquo;s life, <em className="text-harvest">on the record</em>.</>}
        lede="Every adopted tree gets a private Passport. It contains only evidence captured by people on the farm — never generated or staged media." image={IMAGES.coconut} imageAlt="Illustrative coconut palm" />
      <Section>
        <div className="grid gap-px overflow-hidden rounded-[2rem] border border-border bg-border md:grid-cols-2">
          {rows.map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.04} className="bg-card p-8">
              <span className="font-mono text-xs text-harvest">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 font-display text-3xl text-emerald">{t}</h3>
              <p className="mt-2 text-muted-foreground">{d}</p>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start gap-5 rounded-[2rem] bg-emerald p-8 text-ivory md:flex-row md:items-center">
          <QrCode className="h-12 w-12 text-harvest" strokeWidth={1.25} />
          <p className="flex-1 text-lg">Passports become available in your portal once an adoption is active. Sample Passports will not use invented trees.</p>
          <Link href="/sign-in" className="rounded-full bg-harvest px-6 py-3 font-semibold" data-testid="link-passport-signup">Mobile sign-in</Link>
        </div>
      </Section>
    </>
  );
}

export function TransparencyPage() {
  useSeo('Transparency Centre', 'What PICK A TREE will and will not claim, and the gates that must be closed before launch.');
  const will = ['Show estimates and actual measured quantities separately', 'Record crop losses, rejects and retentions with reasons', 'Keep immutable versions of every scheme you accept', 'Correct mistakes with visible, dated correction entries', 'Label illustrative imagery clearly, everywhere'];
  const wont = ['Promise a yield, a return or a resale value', 'Transfer land or tree title', 'Publish generated photos as field evidence', 'List a farm or tree before it is verified', 'Make Nourish a condition of core care'];
  return (
    <>
      <PageHero eyebrow="Transparency Centre" title={<>What we promise is <em className="text-harvest">smaller and truer</em>.</>}
        lede="Agriculture is uncertain. We would rather tell you that plainly than sell you certainty a tree cannot give." />
      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-[2rem] bg-emerald p-9 text-ivory"><h2 className="font-display text-3xl">We will</h2><ul className="mt-6 space-y-4">{will.map((w) => <li key={w} className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-harvest" />{w}</li>)}</ul></div>
          <div className="rounded-[2rem] border border-border bg-card p-9"><h2 className="font-display text-3xl text-emerald">We will not</h2><ul className="mt-6 space-y-4">{wont.map((w) => <li key={w} className="flex gap-3 text-foreground/80"><span className="mt-2 h-2 w-2 shrink-0 rounded-full border border-destructive" />{w}</li>)}</ul></div>
        </div>
        <div className="mt-10"><PrelaunchNotice>PICK A TREE is in prelaunch. Legal terms, pricing, entitlement formulas and payment provider are awaiting approval. The live readiness status appears on the home page.</PrelaunchNotice></div>
      </Section>
    </>
  );
}

export function LearnPage() {
  useSeo('Learn agriculture', 'Plain-language notes on mango, guava and coconut cultivation in Tamil Nadu.');
  const { data: articles, isLoading, isError, error, refetch } = useListArticles();
  return (
    <>
      <PageHero eyebrow="Learn agriculture" title={<>Field notes for <em className="text-harvest">curious families</em>.</>} lede="Seasons, care and harvest explained in plain language, reviewed before publication." />
      <Section>
        {isError ? <ErrorState message={errorMessage(error)} onRetry={() => refetch()} /> : isLoading ? (
          <div className="grid gap-8 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-[1.5rem]" />)}</div>
        ) : articles && articles.length > 0 ? (
          <div className="grid gap-x-8 gap-y-14 md:grid-cols-3">
            {articles.map((a, i) => (
              <Reveal key={a.id} delay={(i % 3) * 0.06} className={i === 0 ? 'md:col-span-2' : ''}>
                <Link href={`/learn/${a.id}`} className="group block" data-testid={`card-article-${a.id}`}>
                  <div className="aspect-[16/10] overflow-hidden rounded-[1.5rem] bg-secondary">
                    {a.image ? <img src={a.image} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><BookOpen className="h-12 w-12 text-leaf/50" strokeWidth={1} /></div>}
                  </div>
                  <p className="mt-5 eyebrow text-harvest">{a.category}{a.readingMinutes ? ` · ${a.readingMinutes} min` : ''}</p>
                  <h3 className="mt-2 font-display text-3xl leading-tight text-emerald group-hover:underline group-hover:decoration-harvest group-hover:underline-offset-4">{a.title}</h3>
                  <p className="mt-2 text-muted-foreground">{a.excerpt}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyState icon={<BookOpen className="h-6 w-6" />} title="The first field notes are being reviewed." body="Articles are published only after agronomic review. Check back soon." />
        )}
      </Section>
    </>
  );
}

export function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { data: articles, isLoading, isError, error, refetch } = useListArticles();
  const article = articles?.find((a) => a.id === id);
  useSeo(article?.title ?? 'Article', article?.excerpt ?? 'A PICK A TREE field note.');
  return (
    <Section className="max-w-3xl">
      <Link href="/learn" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald" data-testid="link-back-learn"><ArrowLeft className="h-4 w-4" /> All field notes</Link>
      {isError ? <div className="mt-8"><ErrorState message={errorMessage(error)} onRetry={() => refetch()} /></div> : isLoading ? (
        <div className="mt-10 space-y-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : !article ? (
        <EmptyState className="mt-10" icon={<BookOpen className="h-6 w-6" />} title="Article not found." body="It may have been unpublished for revision." />
      ) : (
        <article className="mt-10">
          <p className="eyebrow text-harvest">{article.category}{article.readingMinutes ? ` · ${article.readingMinutes} min read` : ''}</p>
          <h1 className="mt-4 text-5xl font-light leading-tight text-emerald" data-testid="text-article-title">{article.title}</h1>
          <p className="mt-5 text-xl leading-relaxed text-muted-foreground">{article.excerpt}</p>
          {article.image && <img src={article.image} alt="" className="mt-10 w-full rounded-[1.5rem]" />}
          <div className="prose prose-lg mt-10 max-w-none whitespace-pre-line prose-p:text-foreground/85" data-testid="text-article-body">{article.body}</div>
        </article>
      )}
    </Section>
  );
}

export function NourishPage() {
  useSeo('Nourish — optional extra care', 'Optional, expert-approved additional nutrition for your adopted tree. Never a condition of core care.');
  return (
    <>
      <PageHero eyebrow="Nourish · optional" title={<>Extra care, only when <em className="text-harvest">you say yes</em>.</>}
        lede="Core care is always funded by your adoption. Nourish is a separate, optional recommendation from a qualified agronomist — itemised, explained, and entirely yours to decline." image={IMAGES.guava} imageAlt="Illustrative guava" />
      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <Steps items={[
            { t: 'Assessment', d: 'A field observation or inspection notes a specific need.' },
            { t: 'Expert recommendation', d: 'Purpose, product, dose, timing, safety restrictions and itemised cost — approved by a qualified agronomist.' },
            { t: 'Your decision', d: 'Approve and pay, or decline. Declining never reduces core care or affects your harvest share.' },
            { t: 'Verified application', d: 'Batch checks, application evidence and manager verification before you are notified.' },
          ]} />
          <div className="space-y-5">
            {['No auto-renewal and no hidden harvest deductions.', 'Recommended, purchased and applied quantities are shown separately.', 'Expired or recalled product batches are blocked from use.', 'Recommendations are never autonomous prescriptions.'].map((t) => (
              <div key={t} className="flex gap-4 rounded-2xl border border-border bg-card p-5"><Sprout className="h-5 w-5 shrink-0 text-leaf" /><p>{t}</p></div>
            ))}
            <PrelaunchNotice>Nourish is not yet available. It requires agronomist approval workflows, product inventory and payments to be live.</PrelaunchNotice>
          </div>
        </div>
      </Section>
    </>
  );
}

export function GiftPage() {
  useSeo('Gift a tree', 'Gift a tree adoption for weddings, birthdays and remembrance. Enquiries are open during prelaunch.');
  return (
    <>
      <PageHero eyebrow="Gift a tree" title={<>A gift that <em className="text-harvest">fruits next summer</em>.</>}
        lede="Weddings, naming ceremonies, anniversaries, remembrance. Tell us the occasion and we will come back with what is genuinely possible — no instant checkout until gifting operations are approved." image={IMAGES.harvestHands} imageAlt="Illustrative harvest basket" />
      <Section>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Heart className="h-8 w-8 text-harvest" strokeWidth={1.5} />
            <h2 className="mt-4 text-4xl font-light text-emerald">How gifting will work</h2>
            <ul className="mt-6 space-y-4 text-muted-foreground">
              <li>Personal certificate and recipient page in English or Tamil.</li>
              <li>Recipient privacy protected — givers see only what is shared.</li>
              <li>Wedding favours with proof approval before dispatch.</li>
            </ul>
          </div>
          <div className="lg:col-span-8"><EnquiryForm kinds={['personal', 'wedding']} defaultKind="personal" showGiftFields submitLabel="Send gift enquiry" /></div>
        </div>
      </Section>
    </>
  );
}

export function CorporatePage() {
  useSeo('Corporate gifting', 'Bulk tree-adoption gifting for teams and clients, quoted individually.');
  return (
    <>
      <PageHero eyebrow="Corporate gifting" title={<>Gifts your team will <em className="text-harvest">actually follow</em>.</>}
        lede="Bulk adoptions with recipient pages, co-branded certificates and corporate invoicing. Quoted individually against real verified inventory." />
      <Section>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            {[['Quote', 'Tiered by quantity and inventory.'], ['Proof', 'Artwork and certificate approval with change deadlines.'], ['Recipients', 'Bulk upload, scheduled dispatch and redemption.'], ['Reporting', 'Recipient engagement, never their private data.']].map(([t, d]) => (
              <div key={t} className="flex gap-4 rounded-2xl bg-card p-5"><Building2 className="h-5 w-5 shrink-0 text-leaf" /><div><p className="font-semibold text-emerald">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div></div>
            ))}
          </div>
          <div className="lg:col-span-8"><EnquiryForm kinds={['corporate']} defaultKind="corporate" showGiftFields submitLabel="Request a corporate quote" /></div>
        </div>
      </Section>
    </>
  );
}

const FAQS = [
  ['Is this an investment?', 'No. You do not receive a financial return, ownership of land or the tree, or any right you can resell. You adopt a relationship with a specific tree and receive a share of its actual harvest under the scheme you accept.'],
  ['Can I adopt a tree today?', 'Not yet. Adoption opens only after real trees are verified, schemes and legal terms are approved, and a payment provider is connected. You can leave an enquiry now.'],
  ['What if my tree has a poor season?', 'Each scheme will state, before you pay, how losses, shortfalls and remedies are handled. We record actual measured quantities and do not promise yields.'],
  ['Where are the farms?', 'The first region is the Madurai–Dindigul belt in Tamil Nadu. Farms are named publicly only after verification.'],
  ['Are the photos on this website real?', 'Images on public pages are illustrative and labelled so. Real tree photos will appear only on verified listings and in your private Passport.'],
  ['Is Nourish required?', 'Never. It is optional extra care, and declining has no effect on core care or your harvest share.'],
  ['Can I visit my tree?', 'Farm visits are being considered but are not offered yet. You can register interest through the contact form.'],
];

export function FaqPage() {
  useSeo('Questions', 'Plain answers about adopting a tree with PICK A TREE.');
  return (
    <>
      <PageHero eyebrow="Questions" title={<>Plain answers, <em className="text-harvest">including the awkward ones</em>.</>} lede="If yours is not here, ask us directly." />
      <Section className="max-w-4xl">
        <Accordion type="single" collapsible className="space-y-3">
          {FAQS.map(([q, a], i) => (
            <AccordionItem key={q} value={`q${i}`} className="rounded-2xl border border-border bg-card px-6">
              <AccordionTrigger className="py-5 text-left font-display text-xl text-emerald hover:no-underline" data-testid={`button-faq-${i}`}>{q}</AccordionTrigger>
              <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <Link href="/contact" className="mt-10 inline-flex items-center gap-2 font-semibold text-harvest" data-testid="link-faq-contact">Ask a question <ArrowRight className="h-4 w-4" /></Link>
      </Section>
    </>
  );
}

export function ContactPage() {
  useSeo('Contact', 'Contact PICK A TREE about adoption, gifting, farm visits or partnerships.');
  return (
    <>
      <PageHero eyebrow="Contact" title={<>Talk to a person, <em className="text-harvest">not a funnel</em>.</>} lede="Adoption interest, farm partnerships, visits or anything else. We reply in English or Tamil." />
      <Section>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <div className="flex gap-4"><MapPin className="h-5 w-5 text-leaf" /><div><p className="font-semibold">Region</p><p className="text-muted-foreground">Madurai–Dindigul, Tamil Nadu</p></div></div>
            <div className="flex gap-4"><Mail className="h-5 w-5 text-leaf" /><div><p className="font-semibold">Replies</p><p className="text-muted-foreground">By email from our team. Support hours are being finalised.</p></div></div>
            <div className="flex gap-4"><Clock className="h-5 w-5 text-leaf" /><div><p className="font-semibold">Prelaunch</p><p className="text-muted-foreground">No payment is requested through any channel during prelaunch.</p></div></div>
          </div>
          <div className="lg:col-span-8"><EnquiryForm kinds={['contact', 'adoption', 'visit']} defaultKind="contact" /></div>
        </div>
      </Section>
    </>
  );
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const isPrivacy = kind === 'privacy';
  useSeo(isPrivacy ? 'Privacy notice' : 'Terms', isPrivacy ? 'Draft privacy notice for PICK A TREE — pending legal review.' : 'Draft terms for PICK A TREE — pending legal review.');
  return (
    <>
      <PageHero eyebrow={isPrivacy ? 'Privacy notice' : 'Terms of service'} title={isPrivacy ? 'Privacy notice' : 'Terms of service'} lede="Status: draft, awaiting professional legal review. Nothing on this page is a final legal term." />
      <Section className="max-w-3xl">
        <div className="flex items-start gap-4 rounded-2xl border-2 border-harvest/50 bg-harvest/8 p-6" data-testid="notice-legal-review">
          <FileWarning className="h-6 w-6 shrink-0 text-harvest" />
          <div>
            <p className="font-semibold text-soil">Prelaunch review status: not approved</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">The approved {isPrivacy ? 'privacy notice, retention schedule and grievance contact' : 'terms, adoption agreement, cancellation and refund policy'} will be published here once reviewed by qualified counsel. Until then, no adoption contract can be formed on this website.</p>
          </div>
        </div>
        <div className="mt-10 space-y-6 text-lg leading-relaxed text-foreground/85">
          {isPrivacy ? (
            <>
              <p>What we currently do: when you submit an enquiry or create an account, we store the details you give us to respond and to maintain your profile. Authentication is handled by a managed identity provider.</p>
              <p>You can request access, correction or deletion of your data from your portal under Profile. Requests are recorded and handled by our team; some records may need to be retained where law requires.</p>
            </>
          ) : (
            <>
              <p>What applies today: this website is informational. Enquiries do not create reservations, adoptions or obligations to pay.</p>
              <p>PICK A TREE adoptions are not investments and confer no ownership of land or trees. Final scheme terms will be versioned and shown in full before any acceptance.</p>
            </>
          )}
        </div>
      </Section>
    </>
  );
}

export function IllustrativeBanner() {
  return <IllustrativeImage src={IMAGES.heroOrchard} alt="Illustrative orchard" className="h-40 rounded-2xl" />;
}
