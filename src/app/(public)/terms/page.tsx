import { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/ui/footer'

export const metadata: Metadata = {
  title: 'Terms of Service - Balance Beacon',
  description: 'Terms of Service for Balance Beacon - the personal finance tracking application.',
}

export default function TermsPage() {
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
            <h1>Terms of Service</h1>
            <p className="text-sm text-slate-400">Last updated: January 17, 2026</p>

            <h2>1. Introduction</h2>
            <p>
              Welcome to Balance Beacon. These Terms of Service (&quot;Terms&quot;) govern your use of the Balance Beacon
              application and services (collectively, the &quot;Service&quot;) operated by Balance Beacon (&quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;).
            </p>
            <p>
              By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part
              of these Terms, you may not access the Service.
            </p>
            <p>
              You must be at least 16 years of age to use this Service. By using the Service, you represent that you
              are at least 16 years old.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              Balance Beacon is a personal finance tracking application that enables you to:
            </p>
            <ul>
              <li>Track expenses and income across multiple accounts</li>
              <li>Create and manage budgets with spending alerts</li>
              <li>Set up recurring transaction templates</li>
              <li>Track investment portfolios and holdings</li>
              <li>Share expenses with friends, family, or roommates</li>
              <li>Export your financial data</li>
              <li>Access your data via web and mobile applications</li>
            </ul>

            <h2>3. User Accounts</h2>
            <p>
              When you create an account with us, you must provide accurate, complete, and current information. Failure
              to do so constitutes a breach of these Terms.
            </p>
            <p>
              You are responsible for safeguarding the password you use to access the Service and for any activities
              or actions under your password. You agree not to disclose your password to any third party and to notify
              us immediately upon becoming aware of any breach of security or unauthorized use of your account.
            </p>
            <p>
              Each user may maintain only one account. Creating multiple accounts may result in termination of all
              your accounts.
            </p>

            <h2>4. Subscription and Billing</h2>
            <h3>Free Trial</h3>
            <p>
              New users are eligible for a 14-day free trial. No credit card is required to start your trial. At the
              end of your trial period, you will need to subscribe to continue using the Service.
            </p>

            <h3>Subscription Pricing</h3>
            <p>
              After your free trial, the Service is available for $3.00 USD per month. This price is subject to change
              with 30 days&apos; notice.
            </p>

            <h3>Automatic Renewal</h3>
            <p>
              Subscriptions automatically renew at the end of each billing period unless you cancel before the renewal
              date. You will be charged for the upcoming period on the same day each month that you first subscribed.
            </p>

            <h3>Cancellation</h3>
            <p>
              You may cancel your subscription at any time through your account settings. Upon cancellation, you will
              retain access to the Service until the end of your current billing period. No refunds are provided for
              partial months.
            </p>

            <h3>Money-Back Guarantee</h3>
            <p>
              We offer a 30-day money-back guarantee for new subscribers. If you are not satisfied with the Service
              within the first 30 days of your paid subscription, contact us for a full refund.
            </p>

            <h3>Price Changes</h3>
            <p>
              We reserve the right to modify subscription prices. Any price changes will be communicated at least 30
              days in advance via email. Continued use of the Service after a price change constitutes acceptance of
              the new pricing.
            </p>

            <h2>5. Acceptable Use</h2>
            <p>
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not
              to:
            </p>
            <ul>
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Attempt to gain unauthorized access to any portion of the Service</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Use automated scripts to collect information from or interact with the Service</li>
              <li>Share your account credentials with others</li>
              <li>Impersonate any person or entity</li>
              <li>Upload viruses or other malicious code</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>

            <h2>6. Intellectual Property</h2>
            <p>
              The Service and its original content (excluding content provided by users), features, and functionality
              are and will remain the exclusive property of Balance Beacon and its licensors. The Service is protected
              by copyright, trademark, and other laws.
            </p>
            <p>
              You retain ownership of all data and content you input into the Service. By using the Service, you grant
              us a limited license to process your data solely for the purpose of providing the Service to you.
            </p>

            <h2>7. User Data</h2>
            <p>
              Your privacy is important to us. Please review our{' '}
              <Link href="/privacy">Privacy Policy</Link> to understand how we collect, use, and protect your
              information.
            </p>
            <p>
              You may export your data at any time using the export features provided within the Service. You may also
              request deletion of your data by contacting support or through your account settings.
            </p>

            <h2>8. Service Availability</h2>
            <p>
              We strive to maintain high availability of the Service but do not guarantee uninterrupted access. The
              Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control.
            </p>
            <p>
              We will make reasonable efforts to provide advance notice of scheduled maintenance through the
              application or via email.
            </p>

            <h2>9. Termination</h2>
            <p>
              You may terminate your account at any time by contacting support or through your account settings. We
              may terminate or suspend your account immediately, without prior notice, for conduct that we believe
              violates these Terms or is harmful to other users, us, or third parties, or for any other reason at our
              sole discretion.
            </p>
            <p>
              Upon termination, your right to use the Service will immediately cease. If you wish to terminate your
              account, you may simply discontinue using the Service and request account deletion.
            </p>

            <h2>10. Disclaimers</h2>
            <p>
              The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, either
              express or implied, including but not limited to implied warranties of merchantability, fitness for a
              particular purpose, non-infringement, or course of performance.
            </p>
            <p>
              <strong>Balance Beacon does not provide financial advice.</strong> The Service is a tool for tracking
              and organizing your personal finances. You should consult qualified financial professionals before
              making any financial decisions. We do not guarantee the accuracy, completeness, or usefulness of any
              information on the Service.
            </p>

            <h2>11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, in no event shall Balance Beacon, its affiliates,
              officers, directors, employees, agents, suppliers, or licensors be liable for any indirect, incidental,
              special, consequential, or punitive damages, including without limitation, loss of profits, data, use,
              goodwill, or other intangible losses, resulting from:
            </p>
            <ul>
              <li>Your access to or use of or inability to access or use the Service</li>
              <li>Any conduct or content of any third party on the Service</li>
              <li>Any content obtained from the Service</li>
              <li>Unauthorized access, use, or alteration of your transmissions or content</li>
            </ul>
            <p>
              In no event shall our total liability to you for all claims exceed the amount paid by you to us in the
              twelve (12) months prior to the claim.
            </p>

            <h2>12. Changes to Terms</h2>
            <p>
              We reserve the right to modify or replace these Terms at any time. Material changes will be communicated
              via email at least 30 days before they become effective. Your continued use of the Service after any
              changes constitutes acceptance of the new Terms.
            </p>
            <p>
              It is your responsibility to review these Terms periodically. If you do not agree to the modified Terms,
              you should discontinue your use of the Service.
            </p>

            <h2>13. Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with applicable laws, without regard to
              conflict of law provisions.
            </p>

            <h2>14. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <p>
              Email:{' '}
              <a href="mailto:support@balancebeacon.app">support@balancebeacon.app</a>
            </p>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  )
}
