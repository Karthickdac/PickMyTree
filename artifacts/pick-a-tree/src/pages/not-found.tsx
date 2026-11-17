import { Link } from 'wouter';
import { TreeDeciduous } from 'lucide-react';
import { useSeo } from '@/lib/brand';

export default function NotFound() {
  useSeo('Page not found', 'This path does not lead to a Pick My Tree page.');
  return (
    <div className="topo-bg flex min-h-[70dvh] w-full items-center justify-center px-5 py-20">
      <div className="max-w-lg text-center">
        <TreeDeciduous className="mx-auto h-14 w-14 text-leaf animate-sway" strokeWidth={1} />
        <p className="eyebrow mt-6 text-harvest">404 · Off the orchard path</p>
        <h1 className="mt-4 text-5xl font-light text-emerald">There is no tree planted here.</h1>
        <p className="mt-4 text-muted-foreground">The page may have moved, or the link was mistyped.</p>
        <Link href="/" className="mt-8 inline-flex rounded-full bg-emerald px-6 py-3 font-semibold text-ivory" data-testid="link-404-home">Back to home</Link>
      </div>
    </div>
  );
}
