import { useState } from "react";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiDelete, apiGet } from "@/api/client";
import ConfirmModal from "./ConfirmModal";
import QuestionFormModal from "./QuestionFormModal";
import { QUESTION_TYPE_LABELS, getErrorMessage, getField } from "./quizAdminUtils";

interface QuestionPanelProps {
  quizId: string;
}

export default function QuestionPanel({ quizId }: QuestionPanelProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["quizzes", "detail", quizId],
    queryFn: () => apiGet<any>(`/quizzes/${quizId}`),
  });
  const questions: any[] = data?.data?.questions ?? [];

  const deleteMutation = useMutation({
    mutationFn: (questionId: string) => apiDelete(`/quizzes/questions/${questionId}`),
    onSuccess: () => {
      toast.success("Question deleted");
      queryClient.invalidateQueries({ queryKey: ["quizzes", "detail", quizId] });
      setPendingDelete(null);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, "Failed to delete question"));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-sm text-red-600">
        {getErrorMessage(error, "Failed to load questions.")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">
          Questions ({questions.length})
        </h4>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Add Question
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
          No questions yet. Add the first question to make this quiz takeable.
        </p>
      ) : (
        <ul className="space-y-2">
          {questions.map((q: any, index: number) => {
            const options: any[] = Array.isArray(q.options) ? q.options : [];
            return (
              <li
                key={q.id}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {index + 1}. {q.text}
                      </span>
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {q.points ?? 1} pt{(q.points ?? 1) === 1 ? "" : "s"}
                      </span>
                    </div>
                    {options.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {options.map((opt: any) => {
                          const correct = Boolean(getField(opt, "is_correct"));
                          return (
                            <li
                              key={opt.id ?? opt.text}
                              className={`flex items-center gap-1.5 text-sm ${
                                correct ? "font-medium text-green-700" : "text-gray-600"
                              }`}
                            >
                              {correct ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                              ) : (
                                <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-gray-300" />
                              )}
                              {opt.text}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {q.explanation && (
                      <p className="mt-1.5 text-xs italic text-gray-500">
                        Explanation: {q.explanation}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(q)}
                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                      title="Edit question"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(q)}
                      className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Delete question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <QuestionFormModal
          quizId={quizId}
          nextSortOrder={questions.length}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <QuestionFormModal
          quizId={quizId}
          question={editing}
          nextSortOrder={questions.length}
          onClose={() => setEditing(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete this question?"
          message={`"${String(pendingDelete.text).slice(0, 120)}" will be permanently removed from the quiz. This action cannot be undone.`}
          busy={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
