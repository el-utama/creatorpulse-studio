import Link from "next/link";
import { TikTokConnectButton } from "@/components/TikTokConnectButton";
import { Navbar } from "@/components/Navbar";
import { ArrowRight, Play, BarChart, Upload } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6">
              Kelola Konten TikTok Anda
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              CreatorPulse Studio membantu kreator TikTok masuk dengan satu klik,
              unggah video langsung ke platform, dan pantau analitik performa
              video secara real-time.
            </p>
            <TikTokConnectButton />
          </div>
        </section>

        {/* Features */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-12 text-center">
              Fitur Utama
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FeatureCard
                icon={Play}
                iconColor="bg-tiktok-primary/10 text-tiktok-primary"
                title="One-Click TikTok OAuth Login"
                description="Masuk dengan akun TikTok melalui OAuth 2.0 standar. Token disimpan aman dalam cookie HTTP-only."
              />
              <FeatureCard
                icon={Upload}
                iconColor="bg-blue-500/10 text-blue-600"
                title="Content Posting & Draft Uploader"
                description="Unggah video lokal atau lewat URL, atur privacy, dan publikasi langsung ke profil atau draft TikTok."
              />
              <FeatureCard
                icon={BarChart}
                iconColor="bg-emerald-500/10 text-emerald-600"
                title="Video Performance Analytics"
                description="Pantau followers, likes, views, dan daftar video terbaru dengan analitik dari Display API."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto bg-card border rounded-xl p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-foreground mb-4">Siap memulai?</h2>
            <p className="text-muted-foreground mb-6">Gabungkan ribuan kreator yang mengelola konten TikTok mereka dengan CreatorPulse Studio.</p>
            <Link href="/api/auth/tiktok" className="inline-flex items-center gap-2 bg-tiktok-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-tiktok-primary/90 transition-colors">
              <ArrowRight className="h-4 w-4" />
              Connect with TikTok
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted/50 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CreatorPulse Studio. All rights reserved.</p>
          <div className="flex gap-6">
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
    <div className="p-6 rounded-xl border border-border bg-background hover:border-tiktok-primary/50 transition-colors">
      <div className={`w-12 h-12 rounded-lg ${iconColor} flex items-center justify-center mb-4`}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}