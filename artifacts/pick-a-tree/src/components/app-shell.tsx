import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useGetMe } from '@workspace/api-client-react';
import { Menu, X, type LucideIcon } from 'lucide-react';
import { Wordmark } from '@/components/site/site-shell';
import { cn } from '@/lib/utils';

export type NavItem = { href: string; label: string; icon: LucideIcon };

export function AppShell({ nav, children, zone, footerLink }: { nav: NavItem[]; children: ReactNode; zone: string; footerLink?: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: me } = useGetMe();
  const name = me?.profile.displayName || me?.displayName || 'Your account';
  const initials = name.split(/\s|@/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');

  const side = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground ring-lines">
      <div className="px-5 pb-6 pt-6"><Link href="/" data-testid="link-app-home"><Wordmark light /></Link>
        <p className="eyebrow mt-6 text-harvest">{zone}</p></div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((n) => {
          const active = location === n.href || (n.href !== nav[0].href && location.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} data-testid={`link-app-${n.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors', active ? 'bg-sidebar-accent text-ivory' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-ivory')}>
              <n.icon className={cn('h-4 w-4', active && 'text-harvest')} />{n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        {footerLink}
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-harvest font-semibold text-ivory">{initials || 'P'}</span>
          <span className="min-w-0 flex-1 truncate text-sm" data-testid="text-user-name">{name}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 lg:block">{side}</aside>
      {open && <div className="fixed inset-0 z-50 flex lg:hidden"><div className="w-72">{side}</div><button type="button" aria-label="Close" className="flex-1 bg-emerald/40" onClick={() => setOpen(false)} /></div>}
      <div className="min-w-0 flex-1">
        <div className="flex h-16 items-center justify-between border-b border-border px-5 lg:hidden">
          <Wordmark />
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2" aria-label="Menu" data-testid="button-app-menu">{open ? <X /> : <Menu />}</button>
        </div>
        <main className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}

export function AppHeading({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="eyebrow text-leaf">{eyebrow}</p><h1 className="mt-3 text-4xl font-light text-emerald md:text-5xl" data-testid="text-app-title">{title}</h1></div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
