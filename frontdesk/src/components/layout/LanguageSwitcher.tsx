"use client";

import React, { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { getLang, setLang, Language, translate } from "@/lib/i18n";

export function LanguageSwitcher() {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    setLangState(getLang());
    const handler = () => setLangState(getLang());
    window.addEventListener("language-changed", handler);
    return () => window.removeEventListener("language-changed", handler);
  }, []);

  // Keep <html lang> in step so screen readers and fonts pick the right language
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as Language;
    setLang(newLang);
    setLangState(newLang);
  };

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cream/80 border border-border rounded-lg text-xs font-semibold text-ink">
      <Globe className="w-3.5 h-3.5 text-muted shrink-0" />
      <select
        value={lang}
        onChange={handleChange}
        className="bg-transparent border-none focus:outline-none cursor-pointer text-xs font-semibold text-ink pr-1"
        aria-label={translate(lang, "nav.language")}
      >
        <option value="en">English</option>
        <option value="hi">हिंदी (Hindi)</option>
        <option value="gu">ગુજરાતી (Gujarati)</option>
      </select>
    </div>
  );
}
