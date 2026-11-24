import Link from "next/link";
import { TikTokConnectButton } from "@/components/TikTokConnectButton";
import { Navbar } from "@/components/Navbar";
import { ArrowRight, Play, BarChart, Upload } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1" id="main-content">
        {/* Hero */}
        <section className="relative px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-6 sm:mb-8">
              Kelola Konten TikTok Anda
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              CreatorPulse Studio membantu kreator TikTok masuk dengan satu klik,
              unggah video langsung ke platform, dan pantau analitik performa
              video secara real-time.
            </p>
            <TikTokConnectButton />
          </div>
        </section>

        {/* Features */}
        <section className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 sm:mb-12 text-center">
              Fitur Utama
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <FeatureCard
                icon={Play}
                iconColor="bg-tiktok-primary/10 text-tiktok-primary"
                title="One-Click TikTok OAuth Login"
                description="Masuk dengan akun TikTok melalui OAuth 2.0 standar. Token disimpan aman dalam cookie HTTP-only."
              />
              <FeatureCard
                icon={Upload}
                iconColor="bg-secondary text-secondary-foreground"
                title="Content Posting & Draft Uploader"
                description="Unggah video lokal atau lewat URL, atur privacy, dan publikasi langsung ke profil atau draft TikTok."
              />
              <FeatureCard
                icon={BarChart}
                iconColor="bg-accent text-accent-foreground"
                title="Video Performance Analytics"
                description="Pantau followers, likes, views, dan daftar video terbaru dengan analitik dari Display API."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto bg-card border rounded-2xl p-6 sm:p-8 text-center shadow-sm">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Siap memulai?</h2>
            <p className="text-sm md:text-base text-muted-foreground mb-6 sm:mb-8">
              Gabungkan ribuan kreator yang mengelola konten TikTok mereka dengan CreatorPulse Studio.
            </p>
            <Link
              href="/api/auth/tiktok"
              className="inline-flex items-center justify-center gap-2 bg-tiktok-primary text-white px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-medium hover:bg-tiktok-primary/90 transition-colors w-full sm:w-auto"
            >
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              Connect with TikTok
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted/50 py-6 sm:py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm sm:text-base text-muted-foreground">
          <p>© {new Date().getFullYear()} CreatorPulse Studio. All rights reserved.</p>
          <div className="flex sm:gap-6 gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, iconColor, title, description }: { icon: React.ElementType; iconColor: string; title: string; description: string }) {
  return (
    <div className="p-4 sm:p-6 rounded-xl border border-border bg-background hover:border-tiktok-primary/50 transition-colors">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg ${iconColor} flex items-center justify-center mb-3 sm:mb-4`}>
        <Icon className="h-5 sm:h-6 w-5 sm:w-6" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}