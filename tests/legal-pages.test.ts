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

  describe('Footer Component', () => {
    it('should export Footer component', async () => {
      const { Footer } = await import('@/components/ui/footer')
      expect(typeof Footer).toBe('function')
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
