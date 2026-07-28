import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { apiPost, apiPut, apiDelete } from "@/api/client";
import { useCategories } from "@/api/hooks";

// Rows from GET /courses/categories come back snake_case (raw knex query on
// the server), including a course_count aggregate.
interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  course_count: number | string;
}

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";

function errMsg(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || fallback;
}

// ── Delete confirmation modal (no native confirm) ───────────────────────────
function DeleteCategoryModal({
  category,
  deleting,
  onCancel,
  onConfirm,
}: {
  category: Category;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const count = Number(category.course_count) || 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-50 p-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900">
              {t("settings.categories.deleteTitle", { name: category.name })}
            </h3>
            <p className="mt-1.5 text-sm text-gray-500">
              {count > 0
                ? t("settings.categories.deleteBodyWithCourses", {
                    count,
                    consequence: category.parent_id
                      ? t("settings.categories.movedToParent")
                      : t("settings.categories.leftUncategorized"),
                  })
                : t("settings.categories.deleteBodyNoCourses")}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main section ────────────────────────────────────────────────────────────
export default function CourseCategoriesSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: catData, isLoading } = useCategories();
  const categories: Category[] = (catData?.data ?? []).filter(
    (c: any) => c && typeof c === "object" && c.id,
  );

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const createMut = useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      apiPost<any>("/courses/categories", body),
    onSuccess: () => {
      toast.success(t("settings.categories.created"));
      setShowAdd(false);
      setAddName("");
      setAddDesc("");
      invalidate();
    },
    onError: (err: any) => toast.error(errMsg(err, t("settings.categories.createFailed"))),
  });

  const updateMut = useMutation({
    mutationFn: (args: { id: string; name: string; description: string }) =>
      apiPut<any>(`/courses/categories/${args.id}`, {
        name: args.name,
        description: args.description,
      }),
    onSuccess: () => {
      toast.success(t("settings.categories.updated"));
      setEditingId(null);
      invalidate();
    },
    onError: (err: any) => toast.error(errMsg(err, t("settings.categories.updateFailed"))),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete<any>(`/courses/categories/${id}`),
    onSuccess: () => {
      toast.success(t("settings.categories.deleted"));
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err: any) => toast.error(errMsg(err, t("settings.categories.deleteFailed"))),
  });

  const submitAdd = () => {
    const name = addName.trim();
    if (!name) {
      toast.error(t("settings.categories.nameRequired"));
      return;
    }
    createMut.mutate({ name, description: addDesc.trim() || undefined });
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || "");
  };

  const submitEdit = () => {
    const name = editName.trim();
    if (!name) {
      toast.error(t("settings.categories.nameRequired"));
      return;
    }
    if (!editingId) return;
    updateMut.mutate({ id: editingId, name, description: editDesc.trim() });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <div className="rounded-lg bg-sky-100 p-2">
          <FolderTree className="h-4 w-4 text-sky-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900">{t("settings.categories.title")}</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {t("settings.categories.subtitle")}
          </p>
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            {t("settings.categories.addCategory")}
          </button>
        )}
      </div>

      <div className="p-6">
        {/* Add form */}
        {showAdd && (
          <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("common.name")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                  className={inputCls}
                  placeholder={t("settings.categories.namePlaceholder")}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("settings.categories.description")} <span className="font-normal text-gray-400">{t("settings.categories.optional")}</span>
                </label>
                <input
                  type="text"
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                  className={inputCls}
                  placeholder={t("settings.categories.descPlaceholder")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setAddName("");
                    setAddDesc("");
                  }}
                  disabled={createMut.isPending}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={submitAdd}
                  disabled={createMut.isPending || !addName.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {createMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {t("settings.categories.createCategory")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 text-center">
            <FolderTree className="h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">
              {t("settings.categories.emptyTitle")}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {t("settings.categories.emptyBody")}
            </p>
            {!showAdd && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                {t("settings.categories.addCategory")}
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {categories.map((cat) => {
              const count = Number(cat.course_count) || 0;
              const isEditing = editingId === cat.id;
              return (
                <li key={cat.id} className="py-3 first:pt-0 last:pb-0">
                  {isEditing ? (
                    <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          {t("common.name")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && submitEdit()}
                          className={inputCls}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          {t("settings.categories.description")}{" "}
                          <span className="font-normal text-gray-400">{t("settings.categories.optional")}</span>
                        </label>
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && submitEdit()}
                          className={inputCls}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={updateMut.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          {t("common.cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={submitEdit}
                          disabled={updateMut.isPending || !editName.trim()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          {updateMut.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          {t("common.save")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            <BookOpen className="h-3 w-3" />
                            {t("settings.categories.courseCount", { count })}
                          </span>
                        </div>
                        {cat.description && (
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {cat.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(cat)}
                          title={t("settings.categories.editCategory")}
                          className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-50 hover:text-indigo-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
                          title={t("settings.categories.deleteCategory")}
                          className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteCategoryModal
          category={deleteTarget}
          deleting={deleteMut.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
        />
      )}
    </section>
  );
}
