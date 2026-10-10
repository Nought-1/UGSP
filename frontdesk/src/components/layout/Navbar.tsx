"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { useBookToken } from "@/components/booking/BookTokenModal";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Clock, History, LayoutDashboard, LogOut, Menu, MonitorPlay, Ticket, X } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { useT } from "@/lib/i18n";

export function Navbar() {
  const { t } = useT();
  const { open: openBooking } = useBookToken();
  const { data: session, status } = useSession();
  const user = session?.user;
  const isAuthenticated = status === "authenticated";
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = () => {
    setIsLoggingOut(true);
    signOut({ callbackUrl: "/login" });
  };

  const navLinks = [
    ...(isAuthenticated
      ? [
          { href: "/citizen/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
          { href: "/citizen/history", label: t("nav.myTokens"), icon: History },
        ]
      : []),
    { href: "/board", label: t("nav.liveBoards"), icon: MonitorPlay },
  ];

  const linkClass = (href: string) =>
    pathname.startsWith(href) ? "bg-brand/10 text-brand font-bold" : "text-muted hover:text-ink hover:bg-cream";

  return (
    <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="leading-none">
              <span className="block font-heading text-2xl font-bold text-ink tracking-tight">{APP_NAME}</span>
              <span className="hidden lg:block text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                {t("app.fullName")}
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${linkClass(link.href)}`}
              >
                <link.icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <Button size="sm" onClick={openBooking} className="hidden sm:inline-flex gap-1.5">
              <Ticket className="w-4 h-4" />
              {t("nav.bookToken")}
            </Button>
          )}

          <LanguageSwitcher />

          {isAuthenticated && user ? (
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
              <div className="text-xs font-bold text-ink">{user.name}</div>
              <Button variant="outline" size="sm" onClick={logout} isLoading={isLoggingOut} aria-label={t("nav.signOut")}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            status !== "loading" && (
              <Link href="/login">
                <Button size="sm" variant="primary">
                  {t("nav.signIn")}
                </Button>
              </Link>
            )
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-ink hover:bg-cream rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t("nav.menu")}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card p-4 space-y-3 animate-fade-in">
          {isAuthenticated && (
            <>
              <Button
                className="w-full gap-2"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openBooking();
                }}
              >
                <Ticket className="w-4 h-4" />
                {t("nav.bookToken")}
              </Button>
              <div className="p-3 bg-cream rounded-lg">
                <p className="text-xs font-bold text-ink">{user?.name}</p>
                <p className="text-[10px] text-muted">{user?.phone}</p>
              </div>
            </>
          )}

          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                  pathname.startsWith(link.href) ? "bg-brand text-white font-bold" : "text-ink hover:bg-cream"
                }`}
              >
                <link.icon className="w-5 h-5" />
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          {isAuthenticated && (
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-brand border-brand/30 hover:bg-brand/5"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
              >
                <LogOut className="w-4 h-4" />
                <span>{t("nav.signOut")}</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
