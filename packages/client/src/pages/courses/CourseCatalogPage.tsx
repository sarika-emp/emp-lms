import { useTranslation } from "react-i18next";

export default function CourseCatalogPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t("misc.courseCatalogTitle")}</h1>
      <p className="mt-2 text-gray-500">{t("misc.comingSoon")}</p>
    </div>
  );
}
