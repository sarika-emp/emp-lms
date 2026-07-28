import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English", flag: "EN" },
  { code: "hi", label: "हिन्दी", flag: "HI" },
  { code: "es", label: "Español", flag: "ES" },
  { code: "fr", label: "Français", flag: "FR" },
  { code: "de", label: "Deutsch", flag: "DE" },
  { code: "ar", label: "العربية", flag: "AR" },
  { code: "pt", label: "Português", flag: "PT" },
  { code: "ja", label: "日本語", flag: "JA" },
  { code: "zh", label: "中文", flag: "ZH" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors text-sm"
        title="Change language"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline text-xs font-medium">{currentLang.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden py-1">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleChange(lang.code)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                i18n.language === lang.code
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-gray-700"
              }`}
            >
              <span className="text-xs font-bold w-6 text-center text-gray-400">{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
