import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { getGetMeQueryKey, useGetMe } from '@workspace/api-client-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/adopt', label: 'Adopt a Tree' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/farms', label: 'Farms' },
  { href: '/tree-passport', label: 'Tree Passport' },
  { href: '/transparency', label: 'Transparency' },
  { href: '/learn', label: 'Learn' },
  { href: '/gift', label: 'Gift' },
];

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-9 w-9" />
      <span className={cn('flex flex-col leading-none', light ? 'text-ivory' : 'text-emerald')}>
        <span className="font-display text-[1.15rem] font-semibold tracking-[0.04em]">PICK A TREE</span>
        <span className="mt-1 font-mono text-[9px] tracking-[0.28em] opacity-70">ADOPT • GROW • HARVEST</span>
      </span>
    </span>
  );
}

function Header() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data: me } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  useEffect(() => setOpen(false), [location]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn('sticky top-0 z-40 transition-colors duration-300', scrolled ? 'border-b border-border/70 bg-background/85 backdrop-blur-xl' : 'bg-transparent')}>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" data-testid="link-home"><Wordmark /></Link>
        <nav className="hidden items-center gap-1 xl:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} data-testid={`link-nav-${n.href.slice(1)}`}
              className={cn('relative rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors hover:text-emerald',
                location.startsWith(n.href) ? 'text-emerald' : 'text-foreground/70')}>
              {n.label}
              {location.startsWith(n.href) && <motion.span layoutId="nav-dot" className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-harvest" />}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {me ? (
            <Link href="/portal" className="inline-flex items-center gap-1.5 rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory" data-testid="link-portal">My portal <ArrowUpRight className="h-4 w-4" /></Link>
          ) : (
            <Link href="/sign-in" className="hidden items-center gap-1.5 rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory transition-transform hover:-translate-y-0.5 sm:inline-flex" data-testid="link-sign-in">
              Sign in with mobile <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
          <button type="button" className="rounded-full p-2.5 text-emerald hover:bg-secondary xl:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu" data-testid="button-menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="border-t border-border bg-background px-5 pb-6 pt-3 xl:hidden">
            {[...NAV, { href: '/nourish', label: 'Nourish' }, { href: '/corporate-gifting', label: 'Corporate gifting' }, { href: '/faq', label: 'FAQ' }, { href: '/contact', label: 'Contact' }].map((n) => (
              <Link key={n.href} href={n.href} className="block border-b border-border/60 py-3.5 font-display text-2xl text-emerald">{n.label}</Link>
            ))}
            {!me && <Link href="/sign-in" className="mt-5 block rounded-full bg-emerald py-3 text-center font-semibold text-ivory">Sign in with mobile</Link>}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function Footer() {
  const cols = [
    { title: 'Adopt', links: [['/adopt', 'Catalogue'], ['/how-it-works', 'How it works'], ['/tree-passport', 'Tree Passport'], ['/nourish', 'Nourish (optional)']] },
    { title: 'Trust', links: [['/farms', 'Farms'], ['/transparency', 'Transparency Centre'], ['/learn', 'Learn agriculture'], ['/faq', 'Questions']] },
    { title: 'Gifting', links: [['/gift', 'Gift a tree'], ['/corporate-gifting', 'Corporate gifting'], ['/contact', 'Contact']] },
    { title: 'Policies', links: [['/privacy', 'Privacy notice'], ['/terms', 'Terms']] },
  ];
  return (
    <footer className="ring-lines relative overflow-hidden bg-emerald text-ivory">
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-20 md:px-8">
        <p className="font-display text-4xl font-light leading-tight md:text-6xl">
          Your Tree. <em className="text-harvest">Your Harvest.</em><br />Your Nature.
        </p>
        <p className="mt-5 max-w-xl text-ivory/70">Reimagining Agriculture. Reconnecting People with Nature. Beginning in the Madurai–Dindigul belt of Tamil Nadu.</p>
        <div className="mt-14 grid grid-cols-2 gap-8 border-t border-ivory/15 pt-10 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1"><Wordmark light /></div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="eyebrow text-ivory/50">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([href, label]) => (
                  <li key={href}><Link href={href} className="text-sm text-ivory/85 transition-colors hover:text-harvest">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col justify-between gap-3 border-t border-ivory/15 pt-6 text-xs text-ivory/55 md:flex-row">
          <span>PICK A TREE is in prelaunch. Adoptions open only after verified inventory, approved schemes and connected payments.</span>
          <span>Not an investment. No returns, title or tradable rights.</span>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
