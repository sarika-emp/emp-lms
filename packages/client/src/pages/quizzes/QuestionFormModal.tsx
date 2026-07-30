import { useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiPost, apiPut } from "@/api/client";
import {
  AUTHORABLE_QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  QuestionOptionRow,
  getErrorMessage,
  getField,
  inputClass,
  labelClass,
  normalizeOptions,
} from "./quizAdminUtils";

interface QuestionFormModalProps {
  quizId: string;
  /** When provided the modal acts as an edit form. */
  question?: any | null;
  /** Used as the default sort_order for a new question. */
  nextSortOrder: number;
  onClose: () => void;
}

function defaultOptions(): QuestionOptionRow[] {
  return [
    { text: "", is_correct: true },
    { text: "", is_correct: false },
  ];
}

export default function QuestionFormModal({
  quizId,
  question,
  nextSortOrder,
  onClose,
}: QuestionFormModalProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(question);
  const queryClient = useQueryClient();

  const initialType: string = question?.type ?? "mcq";
  // matching/ordering questions (authored elsewhere) keep their options untouched.
  const optionsLocked = isEdit && !AUTHORABLE_QUESTION_TYPES.includes(initialType as any);

  const [type, setType] = useState<string>(initialType);
  const [text, setText] = useState<string>(question?.text ?? "");
  const [explanation, setExplanation] = useState<string>(question?.explanation ?? "");
  const [points, setPoints] = useState<string>(String(question?.points ?? 1));
  const [options, setOptions] = useState<QuestionOptionRow[]>(() => {
    const existing = normalizeOptions(question);
    return existing.length > 0 ? existing : defaultOptions();
  });
  const [tfCorrect, setTfCorrect] = useState<"true" | "false">(() => {
    const correct = normalizeOptions(question).find((o) => o.is_correct);
    return correct && correct.text.trim().toLowerCase() === "false" ? "false" : "true";
  });
  const [fillAnswer, setFillAnswer] = useState<string>(() => {
    const existing = normalizeOptions(question);
    return (existing.find((o) => o.is_correct) ?? existing[0])?.text ?? "";
  });
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      isEdit
        ? apiPut<any>(`/quizzes/questions/${question.id}`, body)
        : apiPost<any>(`/quizzes/${quizId}/questions`, body),
    onSuccess: () => {
      toast.success(isEdit ? t("quizzes.toast.questionUpdated") : t("quizzes.toast.questionAdded"));
      queryClient.invalidateQueries({ queryKey: ["quizzes", "detail", quizId] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(
        getErrorMessage(
          err,
          isEdit ? t("quizzes.toast.updateQuestionFailed") : t("quizzes.toast.addQuestionFailed")
        )
      );
    },
  });

  const changeType = (next: string) => {
    setType(next);
    setFormError(null);
    if ((next === "mcq" || next === "multi_select") && options.length < 2) {
      setOptions(defaultOptions());
    }
  };

  const updateOption = (index: number, patch: Partial<QuestionOptionRow>) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  };

  const markCorrectOnly = (index: number) => {
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === index })));
  };

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { text: "", is_correct: false }]);
  };

  const buildSubmitOptions = (): Record<string, any>[] | null => {
    if (type === "mcq" || type === "multi_select") {
      const filled = options.filter((o) => o.text.trim() !== "");
      if (filled.length < 2) {
        setFormError(t("quizzes.errors.minOptions"));
        return null;
      }
      const correctCount = filled.filter((o) => o.is_correct).length;
      if (type === "mcq" && correctCount !== 1) {
        setFormError(t("quizzes.errors.oneCorrect"));
        return null;
      }
      if (type === "multi_select" && correctCount < 1) {
        setFormError(t("quizzes.errors.atLeastOneCorrect"));
        return null;
      }
      return filled.map((o, i) => ({
        ...(o.id ? { id: o.id } : {}),
        text: o.text.trim(),
        is_correct: o.is_correct,
        sort_order: i,
      }));
    }

    if (type === "true_false") {
      const existing = normalizeOptions(question);
      const existingId = (label: string) =>
        existing.find((o) => o.text.trim().toLowerCase() === label)?.id;
      return [
        {
          ...(existingId("true") ? { id: existingId("true") } : {}),
          text: "True",
          is_correct: tfCorrect === "true",
          sort_order: 0,
        },
        {
          ...(existingId("false") ? { id: existingId("false") } : {}),
          text: "False",
          is_correct: tfCorrect === "false",
          sort_order: 1,
        },
      ];
    }

    if (type === "fill_blank") {
      if (fillAnswer.trim() === "") {
        setFormError(t("quizzes.errors.provideAnswer"));
        return null;
      }
      const existing = normalizeOptions(question);
      const existingId = (existing.find((o) => o.is_correct) ?? existing[0])?.id;
      return [
        {
          ...(existingId ? { id: existingId } : {}),
          text: fillAnswer.trim(),
          is_correct: true,
          sort_order: 0,
        },
      ];
    }

    // essay
    return [];
  };

  const handleSubmit = () => {
    setFormError(null);

    if (text.trim() === "") {
      setFormError(t("quizzes.errors.questionTextRequired"));
      return;
    }
    const pts = Number(points);
    if (!Number.isInteger(pts) || pts < 0) {
      setFormError(t("quizzes.errors.pointsInvalid"));
      return;
    }

    const body: Record<string, any> = {
      type,
      text: text.trim(),
      explanation: explanation.trim() || null,
      points: pts,
      sort_order: isEdit ? getField(question, "sort_order") ?? 0 : nextSortOrder,
    };

    if (!optionsLocked) {
      const submitOptions = buildSubmitOptions();
      if (submitOptions === null) return;
      body.options = submitOptions;
    }

    mutation.mutate(body);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !mutation.isPending && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? t("quizzes.editQuestionTitle") : t("quizzes.addQuestion")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("quizzes.form.questionType")}</label>
              {optionsLocked ? (
                <input
                  type="text"
                  value={t(`quizzes.questionType.${type}`, {
                    defaultValue: QUESTION_TYPE_LABELS[type] ?? type,
                  })}
                  disabled
                  className={`${inputClass} bg-gray-50 text-gray-500`}
                />
              ) : (
                <select
                  value={type}
                  onChange={(e) => changeType(e.target.value)}
                  className={inputClass}
                >
                  {AUTHORABLE_QUESTION_TYPES.map((qType) => (
                    <option key={qType} value={qType}>
                      {t(`quizzes.questionType.${qType}`, {
                        defaultValue: QUESTION_TYPE_LABELS[qType],
                      })}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className={labelClass}>{t("quizzes.form.points")}</label>
              <input
                type="number"
                min={0}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              {t("quizzes.form.questionText")} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={t("quizzes.form.questionTextPlaceholder")}
              className={inputClass}
            />
          </div>

          {(type === "mcq" || type === "multi_select") && !optionsLocked && (
            <div>
              <label className={labelClass}>
                {t("quizzes.form.answerOptions")}{" "}
                <span className="font-normal text-gray-500">
                  ({type === "mcq" ? t("quizzes.form.selectOneCorrect") : t("quizzes.form.selectAllCorrect")})
                </span>
              </label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type={type === "mcq" ? "radio" : "checkbox"}
                      name="correct-option"
                      checked={opt.is_correct}
                      onChange={(e) =>
                        type === "mcq"
                          ? markCorrectOnly(i)
                          : updateOption(i, { is_correct: e.target.checked })
                      }
                      className={`h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500 ${
                        type === "mcq" ? "" : "rounded"
                      }`}
                      title={t("quizzes.form.correctAnswer")}
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => updateOption(i, { text: e.target.value })}
                      placeholder={t("quizzes.form.optionPlaceholder", { number: i + 1 })}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      disabled={options.length <= 2}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      title={t("quizzes.form.removeOption")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                <Plus className="h-4 w-4" />
                {t("quizzes.form.addOption")}
              </button>
            </div>
          )}

          {type === "true_false" && !optionsLocked && (
            <div>
              <label className={labelClass}>{t("quizzes.form.correctAnswer")}</label>
              <div className="flex gap-4">
                {(["true", "false"] as const).map((v) => (
                  <label
                    key={v}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
                  >
                    <input
                      type="radio"
                      name="tf-correct"
                      checked={tfCorrect === v}
                      onChange={() => setTfCorrect(v)}
                      className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    {v === "true" ? t("quizzes.trueLabel") : t("quizzes.falseLabel")}
                  </label>
                ))}
              </div>
            </div>
          )}

          {type === "fill_blank" && !optionsLocked && (
            <div>
              <label className={labelClass}>
                {t("quizzes.form.acceptedAnswer")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fillAnswer}
                onChange={(e) => setFillAnswer(e.target.value)}
                placeholder={t("quizzes.form.acceptedAnswerPlaceholder")}
                className={inputClass}
              />
            </div>
          )}

          {type === "essay" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {t("quizzes.form.essayNote")}
            </p>
          )}

          {optionsLocked && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {t("quizzes.form.optionsLockedNote", {
                type: t(`quizzes.questionType.${type}`, {
                  defaultValue: QUESTION_TYPE_LABELS[type] ?? type,
                }),
              })}
            </p>
          )}

          <div>
            <label className={labelClass}>{t("quizzes.form.explanation")}</label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              placeholder={t("quizzes.form.explanationPlaceholder")}
              className={inputClass}
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? t("quizzes.saveChanges") : t("quizzes.addQuestion")}
          </button>
        </div>
      </div>
    </div>
  );
}
