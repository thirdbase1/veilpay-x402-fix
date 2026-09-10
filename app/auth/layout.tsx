import { Wordmark } from '@/components/site/brand'
import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/20 selection:text-primary">
      {/* Top bar */}
      <header className="border-b border-border/40 bg-card/20 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Privacy Infrastructure</span>
          <span className="size-1 rounded-full bg-border" />
          <span className="font-mono text-[11px] text-primary/80">Midnight Network</span>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Bottom bar */}
      <footer className="border-t border-border/40 py-4 px-6 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>VeilPay &middot; Privacy-first merchant payments</p>
        <p className="font-mono text-[11px] text-muted-foreground/70">
          Zero-knowledge cryptographic verification
        </p>
      </footer>
    </div>
  )
}
