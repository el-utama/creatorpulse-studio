import Link from "next/link";

export default function PrivacyPage() {
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
          <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
          <p className="text-muted-foreground mb-4">
            Effective date: November 23, 2026
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">1. Introduction</h2>
          <p className="mb-4">
            CreatorPulse Studio ("we," "us," or "our") operates the web
            application at https://creatorpulse-studio.vercel.app (the
            "Service"). This Privacy Policy explains how we collect, use,
            disclose, and protect your information when you use our Service in
            connection with TikTok for Developers APIs.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">2. Information We Collect</h2>
          <p className="mb-4">We collect the following data solely through your explicit authorization via TikTok Login:</p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>
              <strong>TikTok profile data:</strong> open_id, union_id,
              avatar_url, display_name, bio_description — accessed via the
              <code>user.info.basic</code> and <code>user.info.profile</code>
              OAuth scopes.
            </li>
            <li>
              <strong>Account statistics:</strong> follower_count,
              following_count, likes_count, video_count — accessed via the
              <code>user.info.stats</code> scope to display creator analytics.
            </li>
            <li>
              <strong>Video data:</strong> id, title, video_description,
              cover_image_url, create_time, share_url, view_count, like_count,
              comment_count, share_count — accessed via the
              <code>video.list</code> scope to display your recent videos.
            </li>
            <li>
              <strong>OAuth tokens:</strong> access_token and refresh_token —
              obtained via the TikTok OAuth 2.0 authorization code flow and
              stored in HTTP-only cookies for session management.
            </li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>
              To display your TikTok profile and account statistics on the
              dashboard (<strong>Display API</strong>).
            </li>
            <li>
              To display a list of your recent videos with performance metrics
              (views, likes, comments, shares).
            </li>
            <li>
              To initiate video uploads and publishing to TikTok
              (<strong>Content Posting API</strong>) only when you explicitly
              click the "Publish to TikTok" button. This requires the
              <code>video.upload</code> and <code>video.publish</code> scopes.
            </li>
            <li>
              To authenticate your session and keep you logged in across
              visits.
            </li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-3">4. Video Uploads</h2>
          <p className="mb-4">
            When you choose to upload a video, the video file is streamed
            directly from your browser (or from a public URL you provide) to
            TikTok's upload endpoint. <strong>We do not store your video
            permanently on our servers.</strong> The file is not retained
            after the upload request to TikTok completes or fails.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Sharing and Sale</h2>
          <p className="mb-4">
            We <strong>do not sell your personal data to third parties</strong>.
            We share data only with TikTok's APIs for the purposes described
            above, and only as authorized by you through the OAuth flow.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">6. Data Storage and Security</h2>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>
              Access and refresh tokens are stored in HTTP-only, Secure,
              SameSite=Lax cookies. They are not accessible via JavaScript.
            </li>
            <li>
              We do not use an external database. Session data lives only in
              cookies.
            </li>
            <li>
              All communication with TikTok APIs is conducted over HTTPS.
            </li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-3">7. Your Rights</h2>
          <p className="mb-4">
            You may revoke access or delete your session at any time by
            clicking "Logout," which clears all session cookies. You may also
            revoke TikTok's authorization for this app in your TikTok account
            settings.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-3">8. Contact Us</h2>
          <p className="mb-4">
            If you have questions about this Privacy Policy, contact us at
            {process.env.NEXT_PUBLIC_CONTACT_EMAIL ? <a className="underline" href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}>{process.env.NEXT_PUBLIC_CONTACT_EMAIL}</a> : "a support contact that has not yet been configured."}
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