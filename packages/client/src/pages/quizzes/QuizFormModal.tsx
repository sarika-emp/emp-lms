import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiPost, apiPut } from "@/api/client";
import { getErrorMessage, getField, inputClass, labelClass } from "./quizAdminUtils";

export interface CourseOption {
  id: string;
  title: string;
}

interface QuizFormModalProps {
  courses: CourseOption[];
  /** When provided the modal acts as an edit form (course cannot be changed). */
  quiz?: any | null;
  onClose: () => void;
}

export default function QuizFormModal({ courses, quiz, onClose }: QuizFormModalProps) {
  const isEdit = Boolean(quiz);
  const queryClient = useQueryClient();

  const [courseId, setCourseId] = useState<string>(
    getField<string>(quiz, "course_id") ?? courses[0]?.id ?? ""
  );
  const [title, setTitle] = useState<string>(quiz?.title ?? "");
  const [description, setDescription] = useState<string>(quiz?.description ?? "");
  const [type, setType] = useState<string>(quiz?.type ?? "graded");
  const [passingScore, setPassingScore] = useState<string>(
    String(getField(quiz, "passing_score") ?? 70)
  );
  const [timeLimit, setTimeLimit] = useState<string>(
    getField(quiz, "time_limit_minutes") !== undefined
      ? String(getField(quiz, "time_limit_minutes"))
      : ""
  );
  const [maxAttempts, setMaxAttempts] = useState<string>(
    String(getField(quiz, "max_attempts") ?? 3)
  );
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(
    Boolean(getField(quiz, "shuffle_questions"))
  );
  const [showAnswers, setShowAnswers] = useState<boolean>(
    quiz ? Boolean(getField(quiz, "show_answers")) : true
  );
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      isEdit ? apiPut<any>(`/quizzes/${quiz.id}`, body) : apiPost<any>("/quizzes", body),
    onSuccess: () => {
      toast.success(isEdit ? "Quiz updated" : "Quiz created");
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, isEdit ? "Failed to update quiz" : "Failed to create quiz"));
    },
  });

  const handleSubmit = () => {
    setFormError(null);

    if (!isEdit && !courseId) {
      setFormError("Please select a course.");
      return;
    }
    if (title.trim().length < 2) {
      setFormError("Title must be at least 2 characters.");
      return;
    }
    const score = Number(passingScore);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      setFormError("Passing score must be a whole number between 0 and 100.");
      return;
    }
    const attempts = Number(maxAttempts);
    if (!Number.isInteger(attempts) || attempts < 1) {
      setFormError("Attempts allowed must be a whole number of at least 1.");
      return;
    }
    let limit: number | null = null;
    if (timeLimit.trim() !== "") {
      limit = Number(timeLimit);
      if (!Number.isInteger(limit) || limit < 1) {
        setFormError("Time limit must be a whole number of minutes (or left blank).");
        return;
      }
    }

    const body: Record<string, any> = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      passing_score: score,
      max_attempts: attempts,
      time_limit_minutes: limit,
      shuffle_questions: shuffleQuestions,
      show_answers: showAnswers,
    };
    if (!isEdit) {
      body.course_id = courseId;
    }
    mutation.mutate(body);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !mutation.isPending && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Quiz" : "Create Quiz"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {!isEdit && (
            <div>
              <label className={labelClass}>
                Course <span className="text-red-500">*</span>
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className={inputClass}
              >
                {courses.length === 0 && <option value="">No courses available</option>}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Module 1 Knowledge Check"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this quiz cover?"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                <option value="graded">Graded</option>
                <option value="practice">Practice</option>
                <option value="survey">Survey</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Passing score (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Time limit (minutes)</label>
              <input
                type="number"
                min={1}
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                placeholder="No limit"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Attempts allowed</label>
              <input
                type="number"
                min={1}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Shuffle question order for each attempt
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showAnswers}
                onChange={(e) => setShowAnswers(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              Show correct answers after submission
            </label>
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
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}
