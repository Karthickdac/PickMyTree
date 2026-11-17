import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import { Lock } from 'lucide-react';
import { getGetMeQueryKey, useGetMe } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SiteShell } from '@/components/site/site-shell';
import { Skeleton } from '@/components/ui/skeleton';
import NotFound from '@/pages/not-found';
import HomePage from '@/pages/home';
import { AdoptPage, TreeDetailPage } from '@/pages/adopt';
import {
  ArticlePage, ContactPage, CorporatePage, FaqPage, FarmsPage, GiftPage, HowItWorksPage, LearnPage, LegalPage, NourishPage, PassportPage, TransparencyPage,
} from '@/pages/info';
import SignInPage from '@/pages/sign-in';
import PortalPage from '@/pages/portal';
import WorkspacePage from '@/pages/workspace';
import { ManageFarmDetailPage, ManageFarmsPage } from '@/pages/manage';
import { basePath, errorStatus } from '@/lib/brand';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (n, err) => errorStatus(err) !== 401 && errorStatus(err) !== 403 && errorStatus(err) !== 404 && n < 2, staleTime: 30_000 } },
});

function RequireSession({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  if (isLoading) return <div className="mx-auto max-w-4xl space-y-4 p-10"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-64" /></div>;
  if (!data) {
    return (
      <div className="topo-bg flex min-h-[100dvh] items-center justify-center px-5">
        <div className="max-w-md text-center">
          <Lock className="mx-auto h-10 w-10 text-leaf" strokeWidth={1.25} />
          <h1 className="mt-5 text-4xl font-light text-emerald">Verified sign-in required.</h1>
          <p className="mt-3 text-muted-foreground">{errorStatus(error) === 401 || !error ? 'Sign in with your mobile number and the one-time code sent by SMS to open your private portal.' : 'We could not confirm your session right now.'}</p>
          <div className="mt-7 flex justify-center gap-3">
            <Link href="/sign-in" className="rounded-full bg-emerald px-6 py-3 font-semibold text-ivory" data-testid="link-gate-signin">Sign in with mobile</Link>
            <Link href="/" className="rounded-full border border-emerald px-6 py-3 font-semibold text-emerald" data-testid="link-gate-home">Home</Link>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Public({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/"><Public><HomePage /></Public></Route>
        <Route path="/adopt"><Public><AdoptPage /></Public></Route>
        <Route path="/adopt/:id"><Public><TreeDetailPage /></Public></Route>
        <Route path="/how-it-works"><Public><HowItWorksPage /></Public></Route>
        <Route path="/farms"><Public><FarmsPage /></Public></Route>
        <Route path="/tree-passport"><Public><PassportPage /></Public></Route>
        <Route path="/transparency"><Public><TransparencyPage /></Public></Route>
        <Route path="/learn"><Public><LearnPage /></Public></Route>
        <Route path="/learn/:id"><Public><ArticlePage /></Public></Route>
        <Route path="/nourish"><Public><NourishPage /></Public></Route>
        <Route path="/gift"><Public><GiftPage /></Public></Route>
        <Route path="/corporate-gifting"><Public><CorporatePage /></Public></Route>
        <Route path="/faq"><Public><FaqPage /></Public></Route>
        <Route path="/contact"><Public><ContactPage /></Public></Route>
        <Route path="/privacy"><Public><LegalPage kind="privacy" /></Public></Route>
        <Route path="/terms"><Public><LegalPage kind="terms" /></Public></Route>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignInPage} />
        <Route path="/portal"><RequireSession><PortalPage /></RequireSession></Route>
        <Route path="/portal/:section"><RequireSession><PortalPage /></RequireSession></Route>
        <Route path="/workspace"><RequireSession><WorkspacePage /></RequireSession></Route>
        <Route path="/workspace/:module"><RequireSession><WorkspacePage /></RequireSession></Route>
        <Route path="/manage"><RequireSession><ManageFarmsPage /></RequireSession></Route>
        <Route path="/manage/farms"><RequireSession><ManageFarmsPage /></RequireSession></Route>
        <Route path="/manage/farms/:id"><RequireSession><ManageFarmDetailPage /></RequireSession></Route>
        <Route><Public><NotFound /></Public></Route>
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
