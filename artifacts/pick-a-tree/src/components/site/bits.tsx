import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Camera, RotateCw } from 'lucide-react';
import { ILLUSTRATIVE_LABEL } from '@/lib/brand';
import { cn } from '@/lib/utils';

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function IllustrativeImage({ src, alt, className, imgClassName, labelPosition = 'bottom-left' }: {
  src: string; alt: string; className?: string; imgClassName?: string; labelPosition?: 'bottom-left' | 'top-left';
}) {
  return (
    <figure className={cn('relative overflow-hidden', className)}>
      <img src={src} alt={alt} className={cn('h-full w-full object-cover', imgClassName)} loading="lazy" />
      <figcaption
        className={cn(
          'absolute left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-[hsl(160_62%_10%/0.78)] px-3 py-1.5 text-[10.5px] font-medium leading-tight text-[hsl(42_50%_95%)] backdrop-blur-md',
          labelPosition === 'bottom-left' ? 'bottom-3' : 'top-3',
        )}
        data-testid="label-illustrative"
      >
        <Camera className="h-3 w-3 shrink-0 text-harvest" aria-hidden />
        {ILLUSTRATIVE_LABEL}
      </figcaption>
    </figure>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('eyebrow flex items-center gap-2 text-leaf', className)}>
      <span className="h-px w-6 bg-current opacity-60" />
      {children}
    </div>
  );
}

export function PageHero({ eyebrow, title, lede, children, image, imageAlt }: {
  eyebrow: string; title: ReactNode; lede: ReactNode; children?: ReactNode; image?: string; imageAlt?: string;
}) {
  return (
    <section className="topo-bg relative overflow-hidden border-b border-border/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-14 md:px-8 md:pb-24 md:pt-20 lg:grid-cols-12">
        <div className={cn(image ? 'lg:col-span-7' : 'lg:col-span-10')}>
          <Reveal>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="mt-6 text-[2.6rem] font-light leading-[1.02] text-emerald sm:text-6xl md:text-7xl" data-testid="text-page-title">{title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">{lede}</p>
            {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
          </Reveal>
        </div>
        {image && (
          <Reveal delay={0.15} className="lg:col-span-5">
            <IllustrativeImage src={image} alt={imageAlt ?? ''} className="aspect-[4/5] rounded-[2rem] shadow-xl" />
          </Reveal>
        )}
      </div>
    </section>
  );
}

export function Section({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cn('mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24', className)}>{children}</section>;
}

export function EmptyState({ icon, title, body, children, className }: { icon: ReactNode; title: string; body: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-[1.75rem] border border-dashed border-leaf/40 bg-card/70 px-6 py-14 text-center md:px-12', className)} data-testid="state-empty">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-emerald">{icon}</div>
      <h3 className="text-2xl font-normal text-emerald md:text-3xl">{title}</h3>
      <div className="mx-auto mt-3 max-w-xl text-muted-foreground leading-relaxed">{body}</div>
      {children && <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 sm:flex-row sm:items-center" data-testid="state-error">
      <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
      <div className="flex-1">
        <p className="font-semibold text-foreground">We could not load this right now.</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary" data-testid="button-retry">
          <RotateCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function SampleBadge({ className }: { className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full border border-harvest/40 bg-harvest/12 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-soil', className)} data-testid="badge-verification-pending">Verification pending</span>;
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = status.toLowerCase();
  const tone = /approved|available|active|completed|verified|published|resolved|closed|delivered/.test(s)
    ? 'bg-leaf/15 text-emerald border-leaf/30'
    : /reject|cancel|suspend|retired|fail|declin|expired/.test(s)
      ? 'bg-destructive/10 text-destructive border-destructive/25'
      : /pending|review|progress|submitted|reserved|open/.test(s)
        ? 'bg-harvest/12 text-soil border-harvest/30'
        : 'bg-muted text-muted-foreground border-border';
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider', tone, className)} data-testid={`status-${s}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.replace(/[-_]/g, ' ')}
    </span>
  );
}

export function AvailabilityNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-harvest/35 bg-harvest/8 px-5 py-4 text-sm leading-relaxed text-soil" data-testid="notice-availability">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-harvest" />
      <div>{children}</div>
    </div>
  );
}
