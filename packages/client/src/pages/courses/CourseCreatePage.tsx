import { useTranslation } from "react-i18next";

export default function CourseCreatePage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t("misc.createCourseTitle")}</h1>
      <p className="mt-2 text-gray-500">{t("misc.comingSoon")}</p>
    </div>
  );
}
