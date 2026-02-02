import { describe, expect, it } from 'vitest'
import { TRIAL_DURATION_DAYS, SUBSCRIPTION_PRICE_CENTS } from '@/lib/subscription-constants'

describe('Legal Pages', () => {
  describe('Pricing Page', () => {
    it('should export page metadata with correct title', async () => {
      const { metadata } = await import('@/app/(public)/pricing/page')
      expect(metadata.title).toBe('Pricing - Balance Beacon')
      expect(metadata.description).toContain('14-day free trial')
      expect(metadata.description).toContain('$3/month')
    })

    it('should export default page component', async () => {
      const { default: PricingPage } = await import('@/app/(public)/pricing/page')
      expect(typeof PricingPage).toBe('function')
    })

    it('should use correct subscription constants', () => {
      expect(TRIAL_DURATION_DAYS).toBe(14)
      expect(SUBSCRIPTION_PRICE_CENTS).toBe(300)
    })

    it('should include comparison table in pricing page', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      const pricingPath = path.join(process.cwd(), 'src/app/(public)/pricing/page.tsx')
      const content = await fs.readFile(pricingPath, 'utf-8')

      // Verify comparison table section heading exists
      expect(content).toContain('Free Trial vs Premium')

      // Verify both columns are defined
      expect(content).toContain('Free Trial')
      expect(content).toContain('Premium')

      // Verify key features are listed
      expect(content).toContain('Transaction tracking')
      expect(content).toContain('Budget tracking')
      expect(content).toContain('Multi-currency support')
      expect(content).toContain('Expense sharing')
      expect(content).toContain('Investment tracking')
      expect(content).toContain('Data export')
      expect(content).toContain('Mobile app access')
      expect(content).toContain('Priority support')

      // Verify trial limit indicator
      expect(content).toContain('Limited (50)')
      expect(content).toContain('Unlimited')
    })

    it('should include back navigation link', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      const pricingPath = path.join(process.cwd(), 'src/app/(public)/pricing/page.tsx')
      const content = await fs.readFile(pricingPath, 'utf-8')

      // Verify back link exists with correct text and destination
      expect(content).toContain('Back to app')
      expect(content).toContain('href="/"')
    })
  })

  describe('Terms of Service Page', () => {
    it('should export page metadata with correct title', async () => {
      const { metadata } = await import('@/app/(public)/terms/page')
      expect(metadata.title).toBe('Terms of Service - Balance Beacon')
      expect(metadata.description).toContain('Terms of Service')
    })

    it('should export default page component', async () => {
      const { default: TermsPage } = await import('@/app/(public)/terms/page')
      expect(typeof TermsPage).toBe('function')
    })
  })

  describe('Privacy Policy Page', () => {
    it('should export page metadata with correct title', async () => {
      const { metadata } = await import('@/app/(public)/privacy/page')
      expect(metadata.title).toBe('Privacy Policy - Balance Beacon')
      expect(metadata.description).toContain('Privacy Policy')
    })

    it('should export default page component', async () => {
      const { default: PrivacyPage } = await import('@/app/(public)/privacy/page')
      expect(typeof PrivacyPage).toBe('function')
    })
  })

  describe('Help Center Page', () => {
    it('should export default page component', async () => {
      const { default: HelpPage } = await import('@/app/(public)/help/page')
      expect(typeof HelpPage).toBe('function')
    })

    it('should include search functionality', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      const helpPath = path.join(process.cwd(), 'src/app/(public)/help/page.tsx')
      const content = await fs.readFile(helpPath, 'utf-8')

      // Verify search components are imported
      expect(content).toContain('HelpSearch')
      expect(content).toContain('FAQAccordion')
    })

    it('should include back navigation link', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      const helpPath = path.join(process.cwd(), 'src/app/(public)/help/page.tsx')
      const content = await fs.readFile(helpPath, 'utf-8')

      expect(content).toContain('Back to app')
      expect(content).toContain('href="/"')
    })

    it('should include contact support section', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      const helpPath = path.join(process.cwd(), 'src/app/(public)/help/page.tsx')
      const content = await fs.readFile(helpPath, 'utf-8')

      expect(content).toContain('support@balancebeacon.app')
      expect(content).toContain('Contact Support')
    })
  })

  describe('Help Article Page', () => {
    it('should export generateStaticParams function', async () => {
      const { generateStaticParams } = await import('@/app/(public)/help/[slug]/page')
      expect(typeof generateStaticParams).toBe('function')
      const params = generateStaticParams()
      expect(Array.isArray(params)).toBe(true)
      expect(params.length).toBeGreaterThan(0)
      expect(params[0]).toHaveProperty('slug')
    })

    it('should export generateMetadata function', async () => {
      const { generateMetadata } = await import('@/app/(public)/help/[slug]/page')
      expect(typeof generateMetadata).toBe('function')
    })

    it('should include back to help center link', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      const articlePath = path.join(process.cwd(), 'src/app/(public)/help/[slug]/page.tsx')
      const content = await fs.readFile(articlePath, 'utf-8')

      expect(content).toContain('Back to Help Center')
      expect(content).toContain('href="/help"')
    })
  })

  describe('Footer Component', () => {
    it('should export Footer component', async () => {
      const { Footer } = await import('@/components/ui/footer')
      expect(typeof Footer).toBe('function')
    })

    it('should include Help link', async () => {
      const fs = await import('fs/promises')
      const path = await import('path')
      const footerPath = path.join(process.cwd(), 'src/components/ui/footer.tsx')
      const content = await fs.readFile(footerPath, 'utf-8')

      expect(content).toContain('href="/help"')
      // Check for Help text, accounting for whitespace in JSX
      expect(content).toMatch(/>\s*Help\s*</)
    })
  })
})

describe('Domain References', () => {
  it('should use balancebeacon.app domain in email configuration', async () => {
    // Read the email.ts file content to verify domain
    const fs = await import('fs/promises')
    const path = await import('path')
    const emailPath = path.join(process.cwd(), 'src/lib/email.ts')
    const content = await fs.readFile(emailPath, 'utf-8')

    expect(content).toContain('noreply@balancebeacon.app')
    expect(content).not.toContain('noreply@balancebeacon.com')
  })

  it('should use balancebeacon.app bundle identifiers in mobile app.json', async () => {
    const fs = await import('fs/promises')
    const path = await import('path')
    const appJsonPath = path.join(process.cwd(), 'mobile/app.json')
    const content = await fs.readFile(appJsonPath, 'utf-8')
    const appConfig = JSON.parse(content)

    expect(appConfig.expo.name).toBe('Balance Beacon')
    expect(appConfig.expo.slug).toBe('balance-beacon')
    expect(appConfig.expo.ios.bundleIdentifier).toBe('app.balancebeacon.mobile')
    expect(appConfig.expo.android.package).toBe('app.balancebeacon.mobile')
  })
})

describe('Footer Integration', () => {
  it('should import Footer in login page', async () => {
    const fs = await import('fs/promises')
    const path = await import('path')
    const loginPath = path.join(process.cwd(), 'src/app/login/page.tsx')
    const content = await fs.readFile(loginPath, 'utf-8')

    expect(content).toContain("import { Footer } from '@/components/ui/footer'")
    expect(content).toContain('<Footer />')
  })

  it('should import Footer in register page', async () => {
    const fs = await import('fs/promises')
    const path = await import('path')
    const registerPath = path.join(process.cwd(), 'src/app/register/page.tsx')
    const content = await fs.readFile(registerPath, 'utf-8')

    expect(content).toContain("import { Footer } from '@/components/ui/footer'")
    expect(content).toContain('<Footer />')
  })
})
