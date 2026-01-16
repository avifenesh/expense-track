import { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/ui/footer'

export const metadata: Metadata = {
  title: 'Privacy Policy - Balance Beacon',
  description: 'Privacy Policy for Balance Beacon - how we collect, use, and protect your personal information.',
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <div
        className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_55%),_linear-gradient(145deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]"
        aria-hidden
      />

      <main className="flex-1 px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to app
            </Link>
          </div>

          <article className="prose prose-invert prose-slate max-w-none prose-headings:font-semibold prose-h1:text-4xl prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-p:text-slate-300 prose-li:text-slate-300 prose-a:text-sky-300 hover:prose-a:text-sky-200">
            <h1>Privacy Policy</h1>
            <p className="text-sm text-slate-400">Last updated: January 17, 2026</p>

            <h2>1. Introduction</h2>
            <p>
              Balance Beacon (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our personal finance
              tracking application and services (the &quot;Service&quot;).
            </p>
            <p>
              Please read this Privacy Policy carefully. By using the Service, you agree to the collection and use of
              information in accordance with this policy.
            </p>

            <h2>2. Information We Collect</h2>

            <h3>Account Information</h3>
            <p>When you create an account, we collect:</p>
            <ul>
              <li>Email address</li>
              <li>Display name</li>
              <li>Password (stored as a secure hash, never in plain text)</li>
              <li>Preferred currency</li>
            </ul>

            <h3>Financial Information</h3>
            <p>When you use the Service, you may provide:</p>
            <ul>
              <li>Transaction details (amounts, descriptions, dates, categories)</li>
              <li>Budget configurations and limits</li>
              <li>Investment holdings and portfolio information</li>
              <li>Account balances</li>
              <li>Recurring transaction templates</li>
              <li>Shared expense information</li>
            </ul>

            <h3>Usage Information</h3>
            <p>We automatically collect information about how you interact with the Service:</p>
            <ul>
              <li>Features and pages you access</li>
              <li>Session duration and frequency of use</li>
              <li>Actions taken within the application</li>
            </ul>

            <h3>Technical Information</h3>
            <p>We collect technical information to ensure the Service works properly:</p>
            <ul>
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Device type and operating system</li>
              <li>Time zone setting</li>
            </ul>

            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, operate, and maintain the Service</li>
              <li>Process your subscription and payments</li>
              <li>Send you important notifications about your account</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Improve and personalize your experience</li>
              <li>Analyze usage patterns to enhance the Service</li>
              <li>Detect, prevent, and address security issues and fraud</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>4. Data Sharing</h2>
            <p>
              We do not sell your personal information to third parties. We may share your information only in the
              following circumstances:
            </p>

            <h3>Service Providers</h3>
            <p>
              We may share information with third-party service providers who perform services on our behalf, such as:
            </p>
            <ul>
              <li>Payment processors (for subscription billing)</li>
              <li>Cloud hosting providers (for data storage and processing)</li>
              <li>Email service providers (for transactional emails)</li>
            </ul>
            <p>These providers are bound by contractual obligations to keep your information confidential.</p>

            <h3>Legal Requirements</h3>
            <p>
              We may disclose your information if required by law or in response to valid requests by public
              authorities (e.g., court orders, government agencies).
            </p>

            <h3>Business Transfers</h3>
            <p>
              If we are involved in a merger, acquisition, or sale of assets, your information may be transferred.
              We will provide notice before your information becomes subject to a different privacy policy.
            </p>

            <h3>With Your Consent</h3>
            <p>
              We may share your information for other purposes with your explicit consent.
            </p>

            <h2>5. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide you
              with the Service. You may request deletion of your data at any time.
            </p>
            <p>Upon account deletion request:</p>
            <ul>
              <li>Your account and associated data will be deleted within 30 days</li>
              <li>Some information may be retained for legal, accounting, or audit purposes</li>
              <li>Anonymized, aggregated data may be retained for analytics</li>
            </ul>

            <h2>6. Your Rights (GDPR)</h2>
            <p>
              If you are a resident of the European Economic Area (EEA), you have certain data protection rights
              under the General Data Protection Regulation (GDPR):
            </p>

            <h3>Right to Access</h3>
            <p>You have the right to request copies of your personal data.</p>

            <h3>Right to Rectification</h3>
            <p>
              You have the right to request that we correct any information you believe is inaccurate or complete
              information you believe is incomplete.
            </p>

            <h3>Right to Erasure</h3>
            <p>
              You have the right to request that we erase your personal data under certain conditions.
            </p>

            <h3>Right to Data Portability</h3>
            <p>
              You have the right to request that we transfer your data to another organization or directly to you.
              You can export your data at any time using the export feature in the Service.
            </p>

            <h3>Right to Object</h3>
            <p>
              You have the right to object to our processing of your personal data under certain conditions.
            </p>

            <h3>Right to Restriction</h3>
            <p>
              You have the right to request that we restrict the processing of your personal data under certain
              conditions.
            </p>

            <p>
              To exercise any of these rights, please contact us at{' '}
              <a href="mailto:privacy@balancebeacon.app">privacy@balancebeacon.app</a>. We will respond to your
              request within 30 days.
            </p>

            <h2>7. Cookies and Tracking</h2>
            <p>
              We use essential cookies only to ensure the Service functions properly. These cookies are necessary
              for:
            </p>
            <ul>
              <li>Session management (keeping you logged in)</li>
              <li>CSRF protection (security)</li>
              <li>User preferences (such as theme settings)</li>
            </ul>
            <p>
              We do not use advertising cookies or cross-site tracking technologies. We do not share your browsing
              activity with advertisers.
            </p>

            <h2>8. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your personal
              information:
            </p>
            <ul>
              <li>All data is encrypted in transit using TLS/SSL</li>
              <li>Sensitive data is encrypted at rest</li>
              <li>Passwords are stored using industry-standard hashing algorithms</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Access controls and authentication requirements</li>
              <li>Secure development practices</li>
            </ul>
            <p>
              While we strive to protect your personal information, no method of transmission over the Internet or
              electronic storage is 100% secure. We cannot guarantee absolute security.
            </p>

            <h2>9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence.
              These countries may have data protection laws that are different from the laws of your country.
            </p>
            <p>
              When we transfer data internationally, we take appropriate safeguards to ensure your information
              remains protected in accordance with this Privacy Policy.
            </p>

            <h2>10. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for users under the age of 16. We do not knowingly collect personal
              information from children under 16. If you become aware that a child has provided us with personal
              information, please contact us. If we become aware that we have collected personal information from
              a child under 16 without verification of parental consent, we will take steps to remove that
              information.
            </p>

            <h2>11. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by
              sending an email to the address associated with your account at least 30 days before the changes
              become effective.
            </p>
            <p>
              We encourage you to review this Privacy Policy periodically for any changes. Your continued use of
              the Service after changes to this Privacy Policy constitutes acceptance of those changes.
            </p>

            <h2>12. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <p>
              <strong>Privacy inquiries:</strong>{' '}
              <a href="mailto:privacy@balancebeacon.app">privacy@balancebeacon.app</a>
            </p>
            <p>
              <strong>General support:</strong>{' '}
              <a href="mailto:support@balancebeacon.app">support@balancebeacon.app</a>
            </p>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  )
}
