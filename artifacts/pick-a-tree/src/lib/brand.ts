import { useEffect } from 'react';
import heroOrchard from '@assets/generated_images/hero-orchard.jpg';
import mango from '@assets/generated_images/mango.jpg';
import guava from '@assets/generated_images/guava.jpg';
import coconut from '@assets/generated_images/coconut.jpg';
import farmLandscape from '@assets/generated_images/farm-landscape.jpg';
import harvestHands from '@assets/generated_images/harvest-hands.jpg';

export const IMAGES = { heroOrchard, mango, guava, coconut, farmLandscape, harvestHands };

export const ILLUSTRATIVE_LABEL = 'Illustrative imagery — not a registered PICK A TREE farm or tree';

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function useSeo(title: string, description: string) {
  useEffect(() => {
    document.title = title.includes('PICK A TREE') ? title : `${title} · PICK A TREE`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);
  }, [title, description]);
}

export function formatPaise(paise: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function humanize(value: string) {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function errorMessage(err: unknown): string {
  if (!err) return 'Something went wrong.';
  const anyErr = err as { data?: { error?: string }; message?: string; status?: number };
  return anyErr.data?.error || anyErr.message || 'Something went wrong.';
}

export function errorStatus(err: unknown): number | undefined {
  return (err as { status?: number } | null)?.status;
}

export const SPECIES = [
  { key: 'Mango', tamil: 'மா', image: mango, line: 'The crown of the Madurai–Dindigul belt. Long-lived, generous in a good season, honest about a poor one.', season: 'Typical season: April to June' },
  { key: 'Guava', tamil: 'கொய்யா', image: guava, line: 'Quick to fruit, often twice a year. A tree that rewards attention with a steady rhythm of harvests.', season: 'Often two flushes a year' },
  { key: 'Coconut', tamil: 'தென்னை', image: coconut, line: 'The patient palm. Bunches mature through the year, counted nut by nut rather than kilogram by kilogram.', season: 'Harvests through the year' },
] as const;
