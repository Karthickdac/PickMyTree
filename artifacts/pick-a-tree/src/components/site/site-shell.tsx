import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { getGetMeQueryKey, useGetMe } from '@workspace/api-client-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, ChevronDown, Menu, Tractor, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { canManageFarms } from '@/lib/manage';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/adopt', label: 'Trees' },
  { href: '/farms', label: 'Farms' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/gift', label: 'Gift' },
];
const MORE = [
  { href: '/tree-passport', label: 'Tree Passport' },
  { href: '/transparency', label: 'Transparency' },
  { href: '/learn', label: 'Learn' },
  { href: '/nourish', label: 'Nourish' },
  { href: '/corporate-gifting', label: 'Corporate gifting' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="h-9 w-9" />
      <span className={cn('flex flex-col leading-none', light ? 'text-ivory' : 'text-emerald')}>
        <span className="font-display text-[1.15rem] font-semibold tracking-[0.04em]">Pick My Tree</span>
        <span className="mt-1 font-mono text-[9px] tracking-[0.28em] opacity-70">ADOPT • GROW • HARVEST</span>
      </span>
    </span>
  );
}

function isActiveFor(location: string, href: string) {
  return href === '/' ? location === '/' : location.startsWith(href);
}

function Header() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => isActiveFor(location, href);
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
    <header className={cn('sticky top-0 z-40 transition-colors duration-300', 'border-b border-border bg-card', scrolled && 'shadow-md')}>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" data-testid="link-home"><Wordmark /></Link>
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} data-testid={`link-nav-${n.href.slice(1) || 'home'}`}
              className={cn('relative rounded-full px-4 py-2 text-[14.5px] font-semibold transition-colors',
                isActive(n.href) ? 'text-ivory' : 'text-emerald hover:bg-secondary')}>
              {isActive(n.href) && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-emerald" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <span className="relative">{n.label}</span>
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[14.5px] font-semibold text-emerald outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-nav-more">More <ChevronDown className="h-4 w-4" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
              {MORE.map((m) => <DropdownMenuItem key={m.href} asChild className="rounded-xl px-3 py-2.5 text-[14px] font-medium text-emerald"><Link href={m.href} data-testid={`link-more-${m.href.slice(1)}`}>{m.label}</Link></DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        <div className="flex items-center gap-2">
          {me && canManageFarms(me.roles) && <Link href="/manage/farms" className="hidden items-center gap-1.5 rounded-full border-2 border-harvest bg-card px-4 py-2 text-sm font-semibold text-emerald shadow-sm md:inline-flex" data-testid="link-manage-farms"><Tractor className="h-4 w-4 text-harvest" />Manage farms</Link>}
          {me ? (
            <Link href="/portal" className="hidden items-center gap-1.5 rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory sm:inline-flex" data-testid="link-portal">My portal <ArrowUpRight className="h-4 w-4" /></Link>
          ) : (
            <Link href="/sign-in" className="hidden items-center gap-1.5 rounded-full bg-emerald px-5 py-2.5 text-sm font-semibold text-ivory transition-transform hover:-translate-y-0.5 sm:inline-flex" data-testid="link-sign-in">
              Sign in with mobile <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
          <button type="button" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-emerald shadow-sm lg:hidden" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Menu" data-testid="button-menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}<span>Menu</span>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="max-h-[calc(100dvh-72px)] overflow-y-auto border-t border-border bg-background px-5 pb-8 pt-4 shadow-xl lg:hidden" aria-label="Mobile">
            <div className="grid grid-cols-2 gap-2">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} data-testid={`link-mobile-${n.href.slice(1) || 'home'}`} className={cn('rounded-2xl border px-4 py-4 font-display text-xl', isActive(n.href) ? 'border-emerald bg-emerald text-ivory' : 'border-border bg-card text-emerald')}>{n.label}</Link>
              ))}
            </div>
            <p className="eyebrow mt-6 text-muted-foreground">More</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4">
              {MORE.map((n) => <Link key={n.href} href={n.href} className="border-b border-border/60 py-3 text-[15px] font-medium text-emerald">{n.label}</Link>)}
            </div>
            {me && <Link href="/portal" className="mt-5 block rounded-full bg-emerald py-3 text-center font-semibold text-ivory">My portal</Link>}
            {me && canManageFarms(me.roles) && <Link href="/manage/farms" className="mt-5 block rounded-full border border-emerald py-3 text-center font-semibold text-emerald" data-testid="link-mobile-manage">Manage farms</Link>}
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
    { title: 'Trust', links: [['/farms', 'Farms'], ['/transparency', 'Transparency Centre'], ['/learn', 'Learn agriculture'], ['/faq', 'Questions'], ['/manage/farms', 'Farm owner sign-in']] },
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
          <span>Each tree shows its own availability. Adoption opens after farm verification, scheme approval and payment setup. Farm owners and managers: <Link href="/manage/farms" className="underline underline-offset-4 hover:text-harvest" data-testid="link-footer-manage">manage farms</Link> after signing in.</span>
          <span>Benefits, returns and capital repayment follow the selected scheme’s terms and risks.</span>
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
