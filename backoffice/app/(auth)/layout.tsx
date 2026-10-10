// Staff entry pages (sign-in, first-run setup): a printed-form header on cream paper, frontdesk "Civic" style
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4 sm:p-8">
      <header className="reveal flex items-center gap-3">
        {/* The mark is the brand's rubber stamp */}
        <div className="flex size-11 items-center justify-center bg-brand font-heading text-lg font-bold text-brand-foreground">
          UG
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-heading text-2xl leading-none font-semibold tracking-wide uppercase">UGSP Backoffice</span>
          <span className="micro-label">Staff console · Authorised personnel</span>
        </div>
      </header>

      <div className="reveal w-full max-w-[440px] [--i:1]">{children}</div>

      <footer className="reveal micro-label text-center [--i:2]">
        © 2026 Unified Government Service Platform
      </footer>
    </div>
  );
}
