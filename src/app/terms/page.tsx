import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            CreatorPulse Studio
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Kembali ke Beranda
          </Link>
        </div>
      </nav>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <article className="max-w-3xl mx-auto prose prose-lg max-w-none">
          <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>
          <p className="text-muted-foreground mb-4">
            Effective date: November 23, 2026
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
          <p className="mb-4">
            By accessing or using CreatorPulse Studio (the "Service"), you
            agree to be bound by these Terms of Service. If you do not agree,
            you may not use the Service.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">2. TikTok Platform Compliance</h2>
          <p className="mb-4">
            The Service integrates with TikTok for Developers APIs, including
            Login Kit, Content Posting API, and Display API. You agree to
            comply with TikTok's Terms of Service and Community Guidelines at
            all times. Any violation may result in suspension of your access
            to the Service and revocation of your TikTok authorization.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">3. User Content and Copyright</h2>
          <p className="mb-4">
            You retain all rights to any content you upload or publish through
            the Service. By using the Service to post content to TikTok, you
            represent and warrant that:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>
              You own the content or have the necessary rights, licenses, and
              permissions to upload and publish it.
            </li>
            <li>
              The content does not infringe any copyright, trademark, privacy,
              publicity, or other proprietary right of any third party.
            </li>
            <li>
              The content complies with TikTok's Community Guidelines and
              Terms of Service.
            </li>
          </ul>
          <p className="mb-4">
            You are solely responsible for your content and any consequences
            of publishing it.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">4. Use of the Service</h2>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>
              You must be at least 13 years old (or the minimum age required
              by TikTok in your jurisdiction) to use the Service.
            </li>
            <li>
              You must have a valid TikTok account and authorize the Service
              via TikTok Login (OAuth 2.0).
            </li>
            <li>
              You may not use the Service for any unlawful purpose or in any
              manner that could damage, disable, overburden, or impair the
              Service.
            </li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-3">5. No Warranty</h2>
          <p className="mb-4">
            The Service is provided on an "as is" and "as available" basis
            without warranties of any kind, either express or implied,
            including but not limited to warranties of merchantability,
            fitness for a particular purpose, or non-infringement.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">6. Limitation of Liability</h2>
          <p className="mb-4">
            To the fullest extent permitted by law, CreatorPulse Studio shall
            not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or any loss of profits or
            revenues, whether incurred directly or indirectly, or any loss of
            data, use, goodwill, or other intangible losses, resulting from
            your use of or inability to use the Service.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">7. Termination</h2>
          <p className="mb-4">
            We may terminate or suspend your access to the Service, without
            notice or liability, for any reason, including if you breach these
            Terms. Upon termination, your right to use the Service ceases
            immediately.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">8. Changes to the Terms</h2>
          <p className="mb-4">
            We may revise these Terms at any time. Continued use of the
            Service after changes are posted constitutes acceptance of the new
            terms.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">9. Contact Us</h2>
          <p className="mb-4">
            If you have questions about these Terms of Service, contact us at
            hello@example.com.
          </p>
        </article>
      </main>

      <footer className="border-t border-border bg-muted/50 py-8 px-4">
        <div className="max-w-3xl mx-auto text-sm text-muted-foreground">
          © {new Date().getFullYear()} CreatorPulse Studio. All rights reserved.
        </div>
      </footer>
    </div>
  );
}