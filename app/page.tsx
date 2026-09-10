import { SiteNav } from '@/components/navbar/site-nav'
import { Hero } from '@/components/hero/hero'
import { ValueStrip } from '@/components/trust/value-strip'
import { ProblemSection } from '@/components/problem/problem-section'
import { HowItWorks } from '@/components/how-it-works/how-it-works'
import { PrivacySection } from '@/components/privacy/privacy-section'
import { MidnightSection } from '@/components/midnight/midnight-section'
import { MerchantSection } from '@/components/merchant/merchant-section'
import { DevelopersSection } from '@/components/developers/developers-section'
import { FinalCta } from '@/components/cta/final-cta'
import { SiteFooter } from '@/components/footer/site-footer'

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main id="main">
        <Hero />
        <ValueStrip />
        <ProblemSection />
        <HowItWorks />
        <PrivacySection />
        <MidnightSection />
        <MerchantSection />
        <DevelopersSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  )
}
