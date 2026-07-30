import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <FileQuestion className="h-16 w-16 text-gray-300" />
      <h1 className="mt-4 text-2xl font-bold text-gray-900">{t("misc.notFoundTitle")}</h1>
      <p className="mt-2 text-sm text-gray-500">{t("misc.notFoundBody")}</p>
      <Link
        to="/dashboard"
        className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        {t("misc.backToDashboard")}
      </Link>
    </div>
  );
}
