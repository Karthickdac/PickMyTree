import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { useSubmitEnquiry, type EnquiryInputKind } from '@workspace/api-client-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage } from '@/lib/brand';

const schema = z.object({
  kind: z.enum(['adoption', 'wedding', 'personal', 'corporate', 'contact', 'visit']),
  name: z.string().trim().min(2, 'Please share your name').max(120),
  email: z.string().trim().email('Enter a valid email').max(254),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(5, 'A few words help us respond well').max(5000),
  quantity: z.string().optional(),
  budgetRupees: z.string().optional(),
  eventDate: z.string().optional(),
  location: z.string().max(500).optional(),
  language: z.enum(['en', 'ta']),
  consent: z.boolean().refine((v) => v, 'Consent is required so we can reply'),
});
type Values = z.infer<typeof schema>;

const KIND_LABEL: Record<EnquiryInputKind, string> = {
  adoption: 'Adoption interest', wedding: 'Wedding favours', personal: 'Personal gift',
  corporate: 'Corporate gifting', contact: 'General question', visit: 'Farm visit interest',
};

export function EnquiryForm({ kinds, defaultKind, showGiftFields = false, submitLabel = 'Send enquiry' }: {
  kinds: EnquiryInputKind[]; defaultKind: EnquiryInputKind; showGiftFields?: boolean; submitLabel?: string;
}) {
  const submit = useSubmitEnquiry();
  const [done, setDone] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { kind: defaultKind, name: '', email: '', phone: '', message: '', quantity: '', budgetRupees: '', eventDate: '', location: '', language: 'en', consent: false },
  });

  const onSubmit = (v: Values) => {
    submit.mutate({
      data: {
        kind: v.kind, name: v.name, email: v.email, message: v.message, language: v.language, consent: true,
        phone: v.phone || undefined,
        quantity: v.quantity ? Number(v.quantity) : undefined,
        budgetPaise: v.budgetRupees ? Math.round(Number(v.budgetRupees) * 100) : undefined,
        eventDate: v.eventDate || undefined,
        location: v.location || undefined,
      },
    }, { onSuccess: (res) => { setDone(res.message || 'Thank you. Your enquiry has been recorded.'); form.reset(); } });
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[1.75rem] bg-emerald p-10 text-ivory" data-testid="state-enquiry-success">
        <CheckCircle2 className="h-10 w-10 text-harvest" />
        <h3 className="mt-5 text-3xl font-light">Received, with thanks.</h3>
        <p className="mt-3 text-ivory/80">{done}</p>
        <p className="mt-2 text-sm text-ivory/60">A person on our team will reply. We do not send automated sales sequences.</p>
        <button type="button" onClick={() => setDone(null)} className="mt-6 rounded-full border border-ivory/30 px-5 py-2 text-sm hover:bg-ivory/10" data-testid="button-enquiry-again">Send another</button>
      </motion.div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 rounded-[1.75rem] border border-card-border bg-card p-6 shadow-md md:p-9" data-testid="form-enquiry">
        {kinds.length > 1 && (
          <FormField control={form.control} name="kind" render={({ field }) => (
            <FormItem>
              <FormLabel>What is this about?</FormLabel>
              <div className="flex flex-wrap gap-2">
                {kinds.map((k) => (
                  <button key={k} type="button" onClick={() => field.onChange(k)} data-testid={`button-kind-${k}`}
                    className={`rounded-full border px-4 py-2 text-sm transition-all ${field.value === k ? 'border-emerald bg-emerald text-ivory' : 'border-border bg-background hover:border-leaf'}`}>
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </FormItem>
          )} />
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>Your name</FormLabel><FormControl><Input {...field} className="h-12 bg-background" data-testid="input-name" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} className="h-12 bg-background" data-testid="input-email" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem><FormLabel>Phone (optional)</FormLabel><FormControl><Input {...field} className="h-12 bg-background" data-testid="input-phone" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="language" render={({ field }) => (
            <FormItem><FormLabel>Preferred reply language</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger className="h-12 bg-background" data-testid="select-language"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ta">தமிழ் (Tamil)</SelectItem></SelectContent>
              </Select>
            </FormItem>
          )} />
        </div>
        {showGiftFields && (
          <div className="grid gap-5 md:grid-cols-2">
            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem><FormLabel>Approximate quantity</FormLabel><FormControl><Input type="number" min={1} {...field} className="h-12 bg-background" data-testid="input-quantity" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="budgetRupees" render={({ field }) => (
              <FormItem><FormLabel>Indicative budget (INR)</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} className="h-12 bg-background" data-testid="input-budget" /></FormControl><FormDescription>Helps us scope. Not a quote.</FormDescription></FormItem>
            )} />
            <FormField control={form.control} name="eventDate" render={({ field }) => (
              <FormItem><FormLabel>Event or delivery date</FormLabel><FormControl><Input type="date" {...field} className="h-12 bg-background" data-testid="input-event-date" /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem><FormLabel>City or venue</FormLabel><FormControl><Input {...field} className="h-12 bg-background" data-testid="input-location" /></FormControl></FormItem>
            )} />
          </div>
        )}
        <FormField control={form.control} name="message" render={({ field }) => (
          <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea rows={5} {...field} className="bg-background" data-testid="input-message" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="consent" render={({ field }) => (
          <FormItem>
            <div className="flex items-start gap-3 rounded-xl bg-secondary/60 p-4">
              <FormControl><Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" data-testid="checkbox-consent" /></FormControl>
              <FormLabel className="text-sm font-normal leading-relaxed text-foreground/80">I agree that PICK A TREE may store these details and contact me about this enquiry only. Nothing here creates an adoption, reservation or payment.</FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )} />
        {submit.isError && <p className="text-sm text-destructive" data-testid="text-enquiry-error">{errorMessage(submit.error)}</p>}
        <button type="submit" disabled={submit.isPending} data-testid="button-submit-enquiry"
          className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-harvest px-7 py-4 font-semibold text-ivory transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 md:w-auto">
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          {submitLabel}
        </button>
      </form>
    </Form>
  );
}
