import type { Metadata } from 'next';

import { LandingPage } from '@/src/features/landing/landing-page';

export const metadata: Metadata = {
  title: 'GraphContract — Plan agent behavior before code',
  description:
    'GraphContract lets humans and coding agents visually plan, review, and freeze how an agent should behave before implementation.',
};

export default function Landing() {
  return <LandingPage />;
}
