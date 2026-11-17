import { Link } from 'wouter';
import { ArrowLeft, Smartphone } from 'lucide-react';
import { IMAGES, useSeo } from '@/lib/brand';
import { IllustrativeImage } from '@/components/site/bits';
import { Wordmark } from '@/components/site/site-shell';
import { useGetPhoneAuthConfig, useGetMe } from '@workspace/api-client-react';

export default function SignInPage() {
  useSeo('Sign in', 'Sign in to Pick My Tree with your mobile number and a one-time code.');
  const { data: config, isLoading, isError } = useGetPhoneAuthConfig({ query: { retry: false } });
  const { data: me } = useGetMe({ query: { retry: false } });
  const error = new URLSearchParams(window.location.search).get('error');
  const errorText = error === 'mobile-verification-required'
    ? 'Please verify your mobile number to continue.'
    : error ? 'Sign-in did not complete. Please try again or contact support.' : '';
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <IllustrativeImage src={IMAGES.heroOrchard} alt="Orchard imagery" className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(160_62%_8%/0.9)] to-transparent" />
        <p className="absolute bottom-16 left-10 right-10 font-display text-5xl font-light leading-tight text-ivory">Your Tree.<br /><em className="text-harvest">Your Harvest.</em><br />Your Nature.</p>
      </div>
      <div className="topo-bg flex flex-col px-6 py-8 md:px-14">
        <div className="flex items-center justify-between">
          <Link href="/" data-testid="link-signin-home"><Wordmark /></Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald" data-testid="link-signin-back"><ArrowLeft className="h-4 w-4" />Home</Link>
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-12">
          <p className="eyebrow text-harvest">Pick My Tree</p>
          <h1 className="mt-4 text-4xl font-light leading-tight text-emerald md:text-5xl">Welcome.</h1>
          <p className="mt-4 text-muted-foreground">Your mobile number. One OTP. You’re in.</p>
          {errorText && <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{errorText}</p>}
          {me ? (
            <Link href="/portal" className="mt-7 inline-flex w-full justify-center rounded-full bg-emerald px-6 py-4 font-semibold text-ivory">Open my portal</Link>
          ) : config?.configured ? (
            <>
              <a href={config.loginPath} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald px-6 py-4 font-semibold text-ivory" data-testid="button-mobile-signin"><Smartphone className="h-5 w-5" />Continue with mobile</a>
              <p className="mt-3 text-center text-xs text-muted-foreground">Secure verification opens in a new tab.</p>
            </>
          ) : (
            <p role="status" className="mt-7 rounded-xl border border-harvest/35 bg-harvest/8 p-4 text-sm text-soil">{isLoading ? 'Checking secure sign-in…' : isError ? 'We could not check sign-in availability. Please reload this page.' : 'Mobile sign-in needs provider configuration. Please contact support.'}</p>
          )}
          <Link href="/contact" className="mt-7 block text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-emerald" data-testid="link-signin-enquiry">Need help?</Link>
        </div>
      </div>
    </div>
  );
}
