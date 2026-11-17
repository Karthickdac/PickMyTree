import { Link } from 'wouter';
import { ArrowLeft, KeyRound, MessageSquareText, ShieldCheck, Smartphone } from 'lucide-react';
import { IMAGES, useSeo } from '@/lib/brand';
import { IllustrativeImage } from '@/components/site/bits';
import { Wordmark } from '@/components/site/site-shell';

export default function SignInPage() {
  useSeo('Sign in', 'PICK A TREE sign-in uses your mobile number and a one-time SMS code. Being connected during prelaunch.');
  const steps = [
    { icon: Smartphone, t: 'Enter your mobile number', d: 'Your Indian mobile number becomes your account. No passwords to remember.' },
    { icon: MessageSquareText, t: 'Receive a one-time code by SMS', d: 'A short code is sent by a managed identity provider, valid for a few minutes.' },
    { icon: KeyRound, t: 'Enter the code', d: 'You are signed in to your portal. Repeated attempts are rate-limited.' },
  ];
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <IllustrativeImage src={IMAGES.heroOrchard} alt="Illustrative orchard" className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[hsl(160_62%_8%/0.9)] to-transparent" />
        <p className="absolute bottom-16 left-10 right-10 font-display text-5xl font-light leading-tight text-ivory">Your Tree.<br /><em className="text-harvest">Your Harvest.</em><br />Your Nature.</p>
      </div>
      <div className="topo-bg flex flex-col px-6 py-8 md:px-14">
        <div className="flex items-center justify-between">
          <Link href="/" data-testid="link-signin-home"><Wordmark /></Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald" data-testid="link-signin-back"><ArrowLeft className="h-4 w-4" />Home</Link>
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-12">
          <p className="eyebrow text-harvest">Sign in · being connected</p>
          <h1 className="mt-4 text-4xl font-light leading-tight text-emerald md:text-5xl">Mobile number and a one-time code. Nothing else.</h1>
          <p className="mt-4 text-muted-foreground">We are connecting a managed SMS verification provider. Until it is live, sign-in is unavailable — we will not show a form that pretends to send a code.</p>
          <ol className="mt-10 space-y-3">
            {steps.map((s, i) => (
              <li key={s.t} className="flex gap-4 rounded-2xl border border-border bg-card p-5" data-testid={`step-signin-${i}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-emerald"><s.icon className="h-5 w-5" /></span>
                <div><p className="font-semibold text-emerald">{s.t}</p><p className="mt-1 text-sm text-muted-foreground">{s.d}</p></div>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-harvest/35 bg-harvest/8 p-4 text-sm text-soil" data-testid="notice-auth-setup">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Status: setup needed. Your portal remains protected on the server and cannot be opened without verified sign-in.</span>
          </div>
          <Link href="/contact" className="mt-8 inline-flex w-full justify-center rounded-full bg-emerald px-6 py-4 font-semibold text-ivory" data-testid="link-signin-enquiry">Leave an enquiry instead</Link>
        </div>
      </div>
    </div>
  );
}
