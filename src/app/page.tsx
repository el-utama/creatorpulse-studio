import Link from "next/link";
import { TikTokConnectButton } from "@/components/TikTokConnectButton";
import { Navbar } from "@/components/Navbar";
import { ArrowRight, Play, BarChart, Upload } from "lucide-react";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1" id="main-content">
        {error && <div role="alert" className="mx-auto mt-6 max-w-2xl rounded-lg border border-destructive p-4 text-sm">Koneksi TikTok belum berhasil. Silakan coba hubungkan kembali akun Anda.</div>}
        {/* Hero */}
        <section className="relative px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-6 sm:mb-8">
              Satu Workspace untuk Konten TikTok Anda
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              CreatorPulse Studio membantu kreator TikTok masuk dengan satu klik,
              unggah video langsung ke platform, dan pantau analitik performa
              video langsung dari TikTok.
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
                iconColor="bg-secondary text-secondary-foreground"
                title="Hubungkan Akun TikTok"
                description="Hubungkan akun secara langsung melalui TikTok untuk mengakses konten dan profil Anda."
              />
              <FeatureCard
                icon={Upload}
                iconColor="bg-secondary text-secondary-foreground"
                title="Siapkan dan Publikasikan Konten"
                description="Tinjau video, tentukan visibilitas, lalu kirim ke profil atau inbox TikTok sesuai izin akun."
              />
              <FeatureCard
                icon={BarChart}
                iconColor="bg-accent text-accent-foreground"
                title="Pantau Performa Konten"
                description="Lihat pengikut, suka, tayangan, dan video terbaru dari akun yang terhubung."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto bg-card border rounded-2xl p-6 sm:p-8 text-center shadow-sm">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Siap memulai?</h2>
            <p className="text-sm md:text-base text-muted-foreground mb-6 sm:mb-8">
              Hubungkan akun TikTok untuk mulai mengelola konten Anda.
            </p>
            <Link
              href="/api/auth/tiktok" prefetch={false}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-lg font-medium hover:bg-slate-800 transition-colors w-full sm:w-auto"
            >
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              Hubungkan TikTok
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted/50 py-6 sm:py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm sm:text-base text-muted-foreground">
          <p>© {new Date().getFullYear()} CreatorPulse Studio. All rights reserved.</p>
          <div className="flex sm:gap-6 gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Kebijakan Privasi
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Ketentuan Layanan
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