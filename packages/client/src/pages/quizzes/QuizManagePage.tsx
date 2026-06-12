import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ClipboardCheck,
  Edit,
  Eye,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiGet, apiDelete } from "@/api/client";
import { useAuthStore, isAdminRole } from "@/lib/auth-store";
import ConfirmModal from "./ConfirmModal";
import QuizFormModal, { CourseOption } from "./QuizFormModal";
import QuestionPanel from "./QuestionPanel";
import { getErrorMessage, getField } from "./quizAdminUtils";

function typeBadge(type: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    graded: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Graded" },
    practice: { bg: "bg-green-100", text: "text-green-700", label: "Practice" },
    survey: { bg: "bg-amber-100", text: "text-amber-700", label: "Survey" },
  };
  const s = map[type] ?? map.graded;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export default function QuizManagePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isAdmin = isAdminRole(user?.role);

  // The org-wide GET /quizzes endpoint fails server-side when filtering by the
  // org's course ids, so we list quizzes per course and merge the results.
  const coursesQuery = useQuery({
    queryKey: ["courses", { perPage: 100 }],
    queryFn: () => apiGet<any[]>("/courses", { perPage: 100 }),
    enabled: isAdmin,
  });
  const courses: CourseOption[] = (coursesQuery.data?.data ?? []).map((c: any) => ({
    id: c.id,
    title: c.title,
  }));
  const courseKey = courses.map((c) => c.id).join(",");

  const quizzesQuery = useQuery({
    queryKey: ["quizzes", "manage", courseKey],
    enabled: isAdmin && coursesQuery.isSuccess,
    queryFn: async () => {
      const lists = await Promise.all(
        courses.map(async (c) => {
          const res = await apiGet<any[]>("/quizzes", { course_id: c.id });
          return (res.data ?? []).map((q: any) => ({ ...q, courseTitle: c.title }));
        })
      );
      return lists
        .flat()
        .sort((a: any, b: any) =>
          String(getField(b, "created_at") ?? "").localeCompare(String(getField(a, "created_at") ?? ""))
        );
    },
  });
  const quizzes: any[] = quizzesQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (quizId: string) => apiDelete(`/quizzes/${quizId}`),
    onSuccess: (_data, quizId) => {
      toast.success("Quiz deleted");
      if (expandedId === quizId) setExpandedId(null);
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      setPendingDelete(null);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, "Failed to delete quiz"));
    },
  });

  if (!isAdmin) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <ClipboardCheck className="h-12 w-12 text-gray-400" />
        <h2 className="mt-4 text-lg font-medium text-gray-900">Access Restricted</h2>
        <p className="mt-1 text-sm text-gray-500">Quiz management is available to administrators only.</p>
      </div>
    );
  }

  if (coursesQuery.isLoading || quizzesQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const loadError = coursesQuery.isError
    ? coursesQuery.error
    : quizzesQuery.isError
      ? quizzesQuery.error
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-7 w-7 text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Quiz Management</h1>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Create Quiz
        </button>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {getErrorMessage(loadError, "Failed to load quizzes.")}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <ClipboardCheck className="h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No quizzes yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first quiz to assess learners on course content.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Create Quiz
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Course
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Passing Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Time Limit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Attempts
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {quizzes.map((quiz: any) => {
                const timeLimit = getField<number>(quiz, "time_limit_minutes");
                const expanded = expandedId === quiz.id;
                return (
                  <Fragment key={quiz.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {quiz.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {quiz.courseTitle ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {typeBadge(quiz.type ?? "graded")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {getField(quiz, "passing_score") ?? 70}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {timeLimit ? `${timeLimit} min` : "No limit"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {getField(quiz, "max_attempts") ?? 3}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : quiz.id)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                              expanded
                                ? "bg-brand-50 text-brand-700"
                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            }`}
                            title="Manage questions"
                          >
                            <ListChecks className="h-4 w-4" />
                            Questions
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/quizzes/${quiz.id}`)}
                            className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingQuiz(quiz)}
                            className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                            title="Edit quiz"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(quiz)}
                            className="rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete quiz"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={7} className="bg-gray-50 px-6 py-4">
                          <QuestionPanel quizId={quiz.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <QuizFormModal courses={courses} onClose={() => setCreating(false)} />
      )}

      {editingQuiz && (
        <QuizFormModal
          courses={courses}
          quiz={editingQuiz}
          onClose={() => setEditingQuiz(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title={`Delete "${pendingDelete.title}"?`}
          message="The quiz and its questions will be permanently removed. This action cannot be undone."
          busy={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
