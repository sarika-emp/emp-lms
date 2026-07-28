import { useEffect, useRef, useState } from "react";
import {
  Settings,
  Save,
  Loader2,
  Bell,
  GraduationCap,
  Monitor,
  Globe,
  Clock,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { apiPut } from "@/api/client";
import { useCategories } from "@/api/hooks";
import { useAuthStore, isAdminRole } from "@/lib/auth-store";
import CourseCategoriesSection from "./CourseCategoriesSection";

interface Preferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  courseCompletionAlerts: boolean;
  preferredDifficulty: string;
  preferredCategories: string[];
  language: string;
  timezone: string;
  compactView: boolean;
  darkMode: boolean;
}

const DEFAULT_PREFS: Preferences = {
  emailNotifications: true,
  pushNotifications: true,
  weeklyDigest: false,
  courseCompletionAlerts: true,
  preferredDifficulty: "intermediate",
  preferredCategories: [],
  language: "en",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  compactView: false,
  darkMode: false,
};

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
];

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-gray-200"
        }`}
      >
        <span
          className={`pointer-events-none absolute top-0.5 inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  iconBg,
  iconColor,
  children,
}: {
  icon: React.ComponentType<any>;
  title: string;
  description?: string;
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <div className={`rounded-lg p-2 ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [hasReviewedAll, setHasReviewedAll] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { data: catData } = useCategories();
  const categories: any[] = catData?.data ?? [];
  const user = useAuthStore((s) => s.user);
  const isAdmin = isAdminRole(user?.role);

  // Only enable Save once the user has scrolled past the last section.
  // The layout's <main> has overflow-y-auto, so we need to find that scroll
  // container and listen on it rather than the window. When the sentinel is
  // within ~40px of the top of its scroll container (the bottom of the
  // visible area has reached the sentinel), the user has reached the end.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    // Walk up the DOM to find the nearest scrollable ancestor.
    let scrollParent: HTMLElement | null = el.parentElement;
    while (scrollParent && scrollParent !== document.body) {
      const style = getComputedStyle(scrollParent);
      const overflowY = style.overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && scrollParent.scrollHeight > scrollParent.clientHeight) {
        break;
      }
      scrollParent = scrollParent.parentElement;
    }

    const check = () => {
      const rect = el.getBoundingClientRect();
      // Reached the end when the sentinel is at or above the viewport bottom
      const viewportBottom = window.innerHeight;
      if (rect.top <= viewportBottom) {
        setHasReviewedAll(true);
      }
    };

    // Initial check — in case the page is short enough to already be at the end.
    check();

    const target: HTMLElement | Window = scrollParent ?? window;
    target.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      target.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (catId: string) => {
    setPrefs((prev) => ({
      ...prev,
      preferredCategories: prev.preferredCategories.includes(catId)
        ? prev.preferredCategories.filter((c) => c !== catId)
        : [...prev.preferredCategories, catId],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut("/users/me/preferences", prefs);
      toast.success(t("settings.saved"));
    } catch {
      toast.error(t("settings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 pb-24">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
          <Settings className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("settings.title")}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {t("settings.subtitle")}
          </p>
        </div>
      </div>

      {/* ── Notification Preferences ─────────────────────────────────── */}
      <SectionCard
        icon={Bell}
        title={t("settings.notifications.title")}
        description={t("settings.notifications.subtitle")}
        iconBg="bg-indigo-100"
        iconColor="text-indigo-600"
      >
        <div className="divide-y divide-gray-100">
          <Toggle
            label={t("settings.notifications.emailLabel")}
            description={t("settings.notifications.emailDesc")}
            checked={prefs.emailNotifications}
            onChange={(v) => update("emailNotifications", v)}
          />
          <Toggle
            label={t("settings.notifications.pushLabel")}
            description={t("settings.notifications.pushDesc")}
            checked={prefs.pushNotifications}
            onChange={(v) => update("pushNotifications", v)}
          />
          <Toggle
            label={t("settings.notifications.digestLabel")}
            description={t("settings.notifications.digestDesc")}
            checked={prefs.weeklyDigest}
            onChange={(v) => update("weeklyDigest", v)}
          />
          <Toggle
            label={t("settings.notifications.completionLabel")}
            description={t("settings.notifications.completionDesc")}
            checked={prefs.courseCompletionAlerts}
            onChange={(v) => update("courseCompletionAlerts", v)}
          />
        </div>
      </SectionCard>

      {/* ── Learning Preferences ─────────────────────────────────────── */}
      <SectionCard
        icon={GraduationCap}
        title={t("settings.learning.title")}
        description={t("settings.learning.subtitle")}
        iconBg="bg-emerald-100"
        iconColor="text-emerald-600"
      >
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("settings.learning.preferredDifficulty")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTY_OPTIONS.map((o) => {
                const selected = prefs.preferredDifficulty === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => update("preferredDifficulty", o.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      selected
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {t(`settings.difficulty.${o.value}`, { defaultValue: o.label })}
                  </button>
                );
              })}
            </div>
          </div>

          {categories.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("settings.learning.preferredCategories")}
              </label>
              <p className="mb-2 text-xs text-gray-500">
                {t("settings.learning.categoriesHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                {categories
                  .filter((c: any) => c && typeof c === "object" && c.id)
                  .map((cat: any) => {
                    const selected = prefs.preferredCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                          selected
                            ? "border-indigo-300 bg-indigo-600 text-white"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {cat.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Display Preferences ──────────────────────────────────────── */}
      <SectionCard
        icon={Monitor}
        title={t("settings.display.title")}
        description={t("settings.display.subtitle")}
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("settings.display.language")}</label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={prefs.language}
                  onChange={(e) => update("language", e.target.value)}
                  className={`${inputCls} pl-9`}
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(`settings.language.${o.value}`, { defaultValue: o.label })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("settings.display.timezone")}</label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={prefs.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder={t("settings.display.timezonePlaceholder")}
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 border-t border-gray-100 pt-2">
            <Toggle
              label={t("settings.display.compactLabel")}
              description={t("settings.display.compactDesc")}
              checked={prefs.compactView}
              onChange={(v) => update("compactView", v)}
            />
            <Toggle
              label={t("settings.display.darkLabel")}
              description={t("settings.display.darkDesc")}
              checked={prefs.darkMode}
              onChange={(v) => update("darkMode", v)}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Course Categories (admins only) ──────────────────────────── */}
      {isAdmin && <CourseCategoriesSection />}

      {/* Sentinel — flips hasReviewedAll to true when it scrolls into view */}
      <div ref={sentinelRef} aria-hidden className="h-1" />

      {/* ── Sticky Save Bar ──────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-6 border-t border-gray-100 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            {hasReviewedAll
              ? t("settings.reviewedHint")
              : t("settings.scrollHint")}
          </p>
          <button
            onClick={handleSave}
            disabled={saving || !hasReviewedAll}
            title={!hasReviewedAll ? t("settings.scrollTooltip") : undefined}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t("settings.savePreferences")}
          </button>
        </div>
      </div>
    </div>
  );
}
