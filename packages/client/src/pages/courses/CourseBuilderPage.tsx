import { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Edit,
  Save,
  X,
  FileText,
  Video,
  Link as LinkIcon,
  Code,
  BookOpen,
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/api/client";
import { useAuthStore, isAdminRole } from "@/lib/auth-store";

// --------------- Types ---------------

interface Lesson {
  id: string;
  title: string;
  description: string;
  contentType: string;
  content: string;
  duration: number;
  isMandatory: boolean;
  isPreview: boolean;
  sortOrder: number;
}

interface Module {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  modules: Module[];
}

const CONTENT_TYPES = [
  { value: "text", label: "Text", icon: FileText },
  { value: "video", label: "Video", icon: Video },
  { value: "document", label: "Document", icon: FileText },
  { value: "slide", label: "Slide", icon: BookOpen },
  { value: "scorm", label: "SCORM", icon: Code },
  { value: "link", label: "Link", icon: LinkIcon },
  { value: "embed", label: "Embed", icon: Code },
];

// --------------- Lesson Form ---------------

interface LessonFormData {
  title: string;
  description: string;
  contentType: string;
  content: string;
  duration: number;
  isMandatory: boolean;
  isPreview: boolean;
}

const emptyLesson: LessonFormData = {
  title: "",
  description: "",
  contentType: "text",
  content: "",
  duration: 0,
  isMandatory: false,
  isPreview: false,
};

// Content types where `content` is a URL (stored in content_url) vs a
// free-form text/markdown body (stored in content_text).
const URL_CONTENT_TYPES = new Set(["video", "document", "link", "scorm", "embed"]);

/**
 * Map the camelCase LessonFormData the UI works in to the snake_case payload
 * the server's createLessonSchema expects. Also routes `content` to either
 * `content_url` or `content_text` depending on the content type.
 */
function lessonToPayload(data: LessonFormData) {
  const payload: Record<string, any> = {
    title: data.title.trim(),
    description: data.description?.trim() || undefined,
    content_type: data.contentType,
    duration_minutes: Number(data.duration) || 0,
    is_mandatory: Boolean(data.isMandatory),
    is_preview: Boolean(data.isPreview),
  };
  if (URL_CONTENT_TYPES.has(data.contentType)) {
    if (data.content) payload.content_url = data.content;
  } else {
    if (data.content) payload.content_text = data.content;
  }
  return payload;
}

function LessonForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: LessonFormData;
  onSave: (data: LessonFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<LessonFormData>(initial);

  const set = (field: keyof LessonFormData, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const contentPlaceholder = () => {
    switch (form.contentType) {
      case "video":
        return t("courseBuilder.placeholder.video");
      case "document":
        return t("courseBuilder.placeholder.document");
      case "link":
        return t("courseBuilder.placeholder.link");
      case "embed":
        return t("courseBuilder.placeholder.embed");
      case "scorm":
        return t("courseBuilder.placeholder.scorm");
      default:
        return t("courseBuilder.placeholder.default");
    }
  };

  const isUrlType = ["video", "document", "link"].includes(form.contentType);

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("courseBuilder.titleLabel")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder={t("courseBuilder.lessonTitlePlaceholder")}
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("courseBuilder.descriptionLabel")}
        </label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder={t("courseBuilder.briefDescriptionPlaceholder")}
        />
      </div>

      {/* Content Type */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("courseBuilder.contentTypeLabel")}
        </label>
        <select
          value={form.contentType}
          onChange={(e) => set("contentType", e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {CONTENT_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>
              {t(`courseBuilder.contentType.${ct.value}`, { defaultValue: ct.label })}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t("courseBuilder.contentLabel")}
        </label>
        {form.contentType === "text" ? (
          <textarea
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            rows={6}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder={contentPlaceholder()}
          />
        ) : (
          <input
            type={isUrlType ? "url" : "text"}
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder={contentPlaceholder()}
          />
        )}
        {form.contentType === "scorm" && (
          <p className="mt-1 text-xs text-gray-500">
            {t("courseBuilder.scormHint")}
          </p>
        )}
      </div>

      {/* Duration + checkboxes row */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("courseBuilder.durationLabel")}
          </label>
          <input
            type="number"
            min={0}
            value={form.duration}
            onChange={(e) => set("duration", Number(e.target.value))}
            className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isMandatory}
            onChange={(e) => set("isMandatory", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          {t("courseBuilder.mandatory")}
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isPreview}
            onChange={(e) => set("isPreview", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          {t("courseBuilder.freePreview")}
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          disabled={saving || !form.title.trim()}
          onClick={() => onSave(form)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {t("courseBuilder.saveLesson")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <X className="h-4 w-4" />
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

// --------------- Module Section ---------------

function ModuleSection({
  module,
  courseId,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  module: Module;
  courseId: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(module.title);
  const [editDesc, setEditDesc] = useState(module.description);
  const [addingLesson, setAddingLesson] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["course", courseId] });

  // Module mutations — server routes are /courses/:courseId/modules/:moduleId
  const updateModule = useMutation({
    mutationFn: () =>
      apiPut(`/courses/${courseId}/modules/${module.id}`, {
        title: editTitle,
        description: editDesc,
      }),
    onSuccess: () => {
      toast.success(t("courseBuilder.moduleUpdated"));
      setEditing(false);
      invalidate();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message || t("courseBuilder.updateModuleFailed")),
  });

  const deleteModule = useMutation({
    mutationFn: () => apiDelete(`/courses/${courseId}/modules/${module.id}`),
    onSuccess: () => {
      toast.success(t("courseBuilder.moduleDeleted"));
      invalidate();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message || t("courseBuilder.deleteModuleFailed")),
  });

  // Lesson mutations — server routes are /courses/:courseId/modules/:moduleId/lessons
  const createLesson = useMutation({
    mutationFn: (data: LessonFormData) =>
      apiPost(`/courses/${courseId}/modules/${module.id}/lessons`, lessonToPayload(data)),
    onSuccess: () => {
      toast.success(t("courseBuilder.lessonAdded"));
      setAddingLesson(false);
      invalidate();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message || t("courseBuilder.addLessonFailed")),
  });

  const updateLesson = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LessonFormData }) =>
      apiPut(`/courses/${courseId}/lessons/${id}`, lessonToPayload(data)),
    onSuccess: () => {
      toast.success(t("courseBuilder.lessonUpdated"));
      setEditingLessonId(null);
      invalidate();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message || t("courseBuilder.updateLessonFailed")),
  });

  const deleteLesson = useMutation({
    mutationFn: (id: string) => apiDelete(`/courses/${courseId}/lessons/${id}`),
    onSuccess: () => {
      toast.success(t("courseBuilder.lessonDeleted"));
      invalidate();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message || t("courseBuilder.deleteLessonFailed")),
  });

  // Reorder lessons
  const reorderLessons = useMutation({
    mutationFn: (lessonIds: string[]) =>
      apiPost(`/courses/${courseId}/modules/${module.id}/lessons/reorder`, {
        ordered_ids: lessonIds,
      }),
    onSuccess: () => invalidate(),
    onError: (err: any) =>
      toast.error(err?.response?.data?.error?.message || t("courseBuilder.reorderLessonsFailed")),
  });

  const moveLessonUp = (idx: number) => {
    if (idx === 0) return;
    const ids = module.lessons.map((l) => l.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    reorderLessons.mutate(ids);
  };

  const moveLessonDown = (idx: number) => {
    if (idx >= module.lessons.length - 1) return;
    const ids = module.lessons.map((l) => l.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    reorderLessons.mutate(ids);
  };

  const handleDeleteModule = () => {
    if (
      window.confirm(
        t("courseBuilder.confirmDeleteModule", { title: module.title })
      )
    ) {
      deleteModule.mutate();
    }
  };

  const handleDeleteLesson = (lesson: Lesson) => {
    if (
      window.confirm(
        t("courseBuilder.confirmDeleteLesson", { title: lesson.title })
      )
    ) {
      deleteLesson.mutate(lesson.id);
    }
  };

  const contentTypeIcon = (type: string) => {
    const ct = CONTENT_TYPES.find((c) => c.value === type);
    if (!ct) return <FileText className="h-4 w-4 text-gray-400" />;
    const Icon = ct.icon;
    return <Icon className="h-4 w-4 text-gray-400" />;
  };

  const sortedLessons = [...module.lessons].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Module Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <GripVertical className="h-5 w-5 flex-shrink-0 text-gray-400" />

        {/* Reorder arrows — hidden entirely when there is nothing to reorder */}
        {total > 1 && (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0}
              className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
              title={index === 0 ? t("courseBuilder.alreadyAtTop") : t("courseBuilder.moveUp")}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={index === total - 1}
              className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
              title={index === total - 1 ? t("courseBuilder.alreadyAtBottom") : t("courseBuilder.moveDown")}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Title / edit inline */}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder={t("courseBuilder.moduleTitlePlaceholder")}
              />
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder={t("courseBuilder.descriptionLabel")}
              />
              <button
                type="button"
                onClick={() => updateModule.mutate()}
                disabled={updateModule.isPending || !editTitle.trim()}
                className="inline-flex items-center gap-1 rounded bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {t("common.save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditTitle(module.title);
                  setEditDesc(module.description);
                }}
                className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <X className="h-3.5 w-3.5" />
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-left"
            >
              <h3 className="text-sm font-semibold text-gray-900">
                {/* BUG-09: don't double-prepend "Module N:" when the stored
                    title already starts with a "Module <n>:" prefix. */}
                {/^\s*module\s+\d+\s*:/i.test(module.title)
                  ? module.title
                  : t("courseBuilder.modulePrefix", { num: index + 1, title: module.title })}
              </h3>
              {module.description && (
                <p className="text-xs text-gray-500">{module.description}</p>
              )}
            </button>
          )}
        </div>

        {/* Lesson count badge */}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {t("courseBuilder.lessonCount", { count: module.lessons.length })}
        </span>

        {/* Module actions */}
        {!editing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title={t("courseBuilder.editModule")}
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDeleteModule}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              title={t("courseBuilder.deleteModule")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Lessons list (collapsible) */}
      {expanded && (
        <div className="p-4">
          {sortedLessons.length === 0 && !addingLesson && (
            <p className="py-4 text-center text-sm text-gray-400">
              {t("courseBuilder.noLessonsYet")}
            </p>
          )}

          <div className="space-y-2">
            {sortedLessons.map((lesson, li) => (
              <div key={lesson.id}>
                {editingLessonId === lesson.id ? (
                  <LessonForm
                    initial={{
                      title: lesson.title,
                      description: lesson.description,
                      contentType: lesson.contentType,
                      content: lesson.content,
                      duration: lesson.duration,
                      isMandatory: lesson.isMandatory,
                      isPreview: lesson.isPreview,
                    }}
                    onSave={(data) =>
                      updateLesson.mutate({ id: lesson.id, data })
                    }
                    onCancel={() => setEditingLessonId(null)}
                    saving={updateLesson.isPending}
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-3 py-2 hover:border-gray-200">
                    <GripVertical className="h-4 w-4 flex-shrink-0 text-gray-300" />

                    {/* Lesson reorder — hidden when there is nothing to reorder */}
                    {sortedLessons.length > 1 && (
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveLessonUp(li)}
                          disabled={li === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLessonDown(li)}
                          disabled={li === sortedLessons.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    {contentTypeIcon(lesson.contentType)}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {lesson.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="capitalize">
                          {t(`courseBuilder.contentType.${lesson.contentType}`, { defaultValue: lesson.contentType })}
                        </span>
                        {lesson.duration > 0 && (
                          <span>{t("courseBuilder.minutesShort", { count: lesson.duration })}</span>
                        )}
                        {lesson.isMandatory && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                            {t("courseBuilder.mandatory")}
                          </span>
                        )}
                        {lesson.isPreview && (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">
                            {t("courseBuilder.preview")}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingLessonId(lesson.id)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      title={t("courseBuilder.editLesson")}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLesson(lesson)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title={t("courseBuilder.deleteLesson")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Lesson */}
          {addingLesson ? (
            <div className="mt-3">
              <LessonForm
                initial={emptyLesson}
                onSave={(data) => createLesson.mutate(data)}
                onCancel={() => setAddingLesson(false)}
                saving={createLesson.isPending}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingLesson(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-brand-400 hover:text-brand-600"
            >
              <Plus className="h-4 w-4" />
              {t("courseBuilder.addLesson")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --------------- Main Page ---------------

export default function CourseBuilderPage() {
  const { t } = useTranslation();
  const { id: courseId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Admin-only page. Non-admins who land here via a stray URL are
  // redirected to the catalog. Server-side middleware also blocks the
  // underlying mutations, but this avoids the form flashing into view.
  const currentUser = useAuthStore((s) => s.user);
  if (!isAdminRole(currentUser?.role)) {
    return <Navigate to="/courses" replace />;
  }

  // Fetch course
  const {
    data: courseRes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => apiGet<Course>(`/courses/${courseId}`),
    enabled: !!courseId,
  });

  const course = courseRes?.data;

  // Add module form state
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleDesc, setNewModuleDesc] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["course", courseId] });

  const createModule = useMutation({
    mutationFn: () =>
      apiPost(`/courses/${courseId}/modules`, {
        title: newModuleTitle,
        description: newModuleDesc,
      }),
    onSuccess: () => {
      toast.success(t("courseBuilder.moduleCreated"));
      setNewModuleTitle("");
      setNewModuleDesc("");
      setShowAddModule(false);
      invalidate();
    },
    onError: () => toast.error(t("courseBuilder.createModuleFailed")),
  });

  const reorderModules = useMutation({
    mutationFn: (moduleIds: string[]) =>
      apiPost(`/courses/${courseId}/modules/reorder`, { ordered_ids: moduleIds }),
    onSuccess: () => invalidate(),
    onError: () => toast.error(t("courseBuilder.reorderModulesFailed")),
  });

  const sortedModules = course?.modules
    ? [...course.modules].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  const moveModuleUp = (idx: number) => {
    if (idx === 0) return;
    const ids = sortedModules.map((m) => m.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    reorderModules.mutate(ids);
  };

  const moveModuleDown = (idx: number) => {
    if (idx >= sortedModules.length - 1) return;
    const ids = sortedModules.map((m) => m.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    reorderModules.mutate(ids);
  };

  // --------------- Render ---------------

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">
          {t("courseBuilder.loadFailed")}{" "}
          <Link to="/courses" className="text-brand-600 hover:underline">
            {t("courseBuilder.backToCourses")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <Link
          to={`/courses/${courseId}`}
          className="text-sm text-brand-600 hover:underline"
        >
          &larr; {t("courseBuilder.backToCourse")}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          {t("courseBuilder.courseBuilderTitle")}
        </h1>
        <p className="text-sm text-gray-500">{course.title}</p>
      </div>

      {/* Module list */}
      <div className="space-y-4">
        {sortedModules.map((mod, idx) => (
          <ModuleSection
            key={mod.id}
            module={mod}
            courseId={courseId!}
            index={idx}
            total={sortedModules.length}
            onMoveUp={() => moveModuleUp(idx)}
            onMoveDown={() => moveModuleDown(idx)}
          />
        ))}
      </div>

      {sortedModules.length === 0 && !showAddModule && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            {t("courseBuilder.noModulesYet")}
          </p>
        </div>
      )}

      {/* Add Module */}
      {showAddModule ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            {t("courseBuilder.newModule")}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("courseBuilder.titleLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder={t("courseBuilder.moduleTitlePlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("courseBuilder.descriptionLabel")}
              </label>
              <input
                type="text"
                value={newModuleDesc}
                onChange={(e) => setNewModuleDesc(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder={t("courseBuilder.moduleDescOptionalPlaceholder")}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={createModule.isPending || !newModuleTitle.trim()}
                onClick={() => createModule.mutate()}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {t("courseBuilder.createModule")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddModule(false);
                  setNewModuleTitle("");
                  setNewModuleDesc("");
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddModule(true)}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          {t("courseBuilder.addModule")}
        </button>
      )}
    </div>
  );
}
