// ============================================================================
// Shared ILT helpers: session normalization, status badges, confirm modal,
// and the create/edit session form modal (used by ILTPage + detail page).
// ============================================================================

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, Loader2, Search, X } from "lucide-react";
import dayjs from "dayjs";
import { apiGet, apiPost, apiPut } from "@/api/client";

// ---------------------------------------------------------------------------
// Types + normalization
// ---------------------------------------------------------------------------

/**
 * Sessions arrive camelCased from adapter findOne/findMany (GET /ilt without
 * date filters, GET /ilt/sessions/:id) but snake_cased from db.raw paths
 * (GET /ilt with start_date/end_date, GET /ilt/my/sessions). Normalize both.
 */
export interface IltSession {
  id: string;
  title: string;
  description: string | null;
  instructorId: number | null;
  instructorName: string | null;
  courseId: string | null;
  location: string | null;
  meetingUrl: string | null;
  materialsUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  maxAttendees: number | null;
  enrolledCount: number;
  status: string;
  /** Only present on /ilt/my/sessions rows */
  attendanceStatus: string | null;
  checkedInAt: string | null;
}

export function normalizeSession(raw: any): IltSession {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? null,
    instructorId: raw.instructorId ?? raw.instructor_id ?? null,
    instructorName: raw.instructor_name ?? raw.instructorName ?? null,
    courseId: raw.courseId ?? raw.course_id ?? null,
    location: raw.location ?? null,
    meetingUrl: raw.meetingUrl ?? raw.meeting_url ?? null,
    materialsUrl: raw.materialsUrl ?? raw.materials_url ?? null,
    startTime: raw.startTime ?? raw.start_time ?? null,
    endTime: raw.endTime ?? raw.end_time ?? null,
    maxAttendees: raw.maxAttendees ?? raw.max_attendees ?? null,
    enrolledCount: raw.enrolledCount ?? raw.enrolled_count ?? 0,
    status: raw.status,
    attendanceStatus: raw.attendanceStatus ?? raw.attendance_status ?? null,
    checkedInAt: raw.checkedInAt ?? raw.checked_in_at ?? null,
  };
}

export function isSessionFull(s: Pick<IltSession, "maxAttendees" | "enrolledCount">): boolean {
  return s.maxAttendees != null && s.enrolledCount >= s.maxAttendees;
}

/** Extract a server error message from a thrown axios error. */
export function apiErrorMessage(err: any, fallback: string): string {
  return (
    err?.response?.data?.error?.message ??
    err?.error?.message ??
    fallback
  );
}

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

const SESSION_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: "bg-green-100", text: "text-green-700", label: "Scheduled" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700", label: "In Progress" },
  completed: { bg: "bg-gray-100", text: "text-gray-600", label: "Completed" },
  cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
};

const ATTENDANCE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  registered: { bg: "bg-blue-100", text: "text-blue-700", label: "Registered" },
  attended: { bg: "bg-green-100", text: "text-green-700", label: "Attended" },
  absent: { bg: "bg-red-100", text: "text-red-700", label: "Absent" },
  excused: { bg: "bg-amber-100", text: "text-amber-700", label: "Excused" },
};

function badge(style: { bg: string; text: string; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export function SessionStatusBadge({ status }: { status: string }) {
  const s = SESSION_STATUS_STYLES[status] ?? { bg: "bg-gray-100", text: "text-gray-600", label: status };
  return badge(s);
}

export function AttendanceStatusBadge({ status }: { status: string }) {
  const s = ATTENDANCE_STATUS_STYLES[status] ?? { bg: "bg-gray-100", text: "text-gray-600", label: status };
  return badge(s);
}

export function FullBadge() {
  return badge({ bg: "bg-amber-100", text: "text-amber-700", label: "Full" });
}

// ---------------------------------------------------------------------------
// Confirm modal (replaces native confirm())
// ---------------------------------------------------------------------------

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  tone = "primary",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition ${
              tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instructor picker (searchable dropdown over GET /users/search)
// ---------------------------------------------------------------------------

interface SearchUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  designation: string | null;
}

function InstructorPicker({
  value,
  valueName,
  onChange,
}: {
  value: number | null;
  valueName: string | null;
  onChange: (id: number | null, name: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["users", "search", debounced],
    queryFn: () =>
      apiGet<SearchUser[]>("/users/search", { q: debounced, limit: 20, includeSelf: 1 }),
    enabled: open,
  });
  const users = data?.data ?? [];

  if (value != null) {
    return (
      <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
        <span className="font-medium text-gray-900">{valueName ?? `User #${value}`}</span>
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="text-gray-400 hover:text-gray-600 transition"
          aria-label="Clear instructor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search employees by name..."
          className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
            </div>
          ) : users.length === 0 ? (
            <p className="p-3 text-sm text-gray-500">No employees found</p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange(u.id, `${u.first_name} ${u.last_name}`);
                  setOpen(false);
                  setSearch("");
                }}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-gray-50 transition"
              >
                <span className="text-sm font-medium text-gray-900">
                  {u.first_name} {u.last_name}
                </span>
                <span className="text-xs text-gray-500">
                  {u.designation ? `${u.designation} · ` : ""}
                  {u.email}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit session modal
// ---------------------------------------------------------------------------

export function SessionFormModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** When provided, the modal edits this session (PUT) instead of creating one. */
  initial?: IltSession | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructorId, setInstructorId] = useState<number | null>(null);
  const [instructorName, setInstructorName] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [materialsUrl, setMaterialsUrl] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // (Re)seed the form whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setInstructorId(initial?.instructorId ?? null);
    setInstructorName(initial?.instructorName ?? null);
    setCourseId(initial?.courseId ?? "");
    setLocation(initial?.location ?? "");
    setMeetingUrl(initial?.meetingUrl ?? "");
    setMaterialsUrl(initial?.materialsUrl ?? "");
    setStartLocal(initial?.startTime ? dayjs(initial.startTime).format("YYYY-MM-DDTHH:mm") : "");
    setEndLocal(initial?.endTime ? dayjs(initial.endTime).format("YYYY-MM-DDTHH:mm") : "");
    setMaxAttendees(initial?.maxAttendees != null ? String(initial.maxAttendees) : "");
    // Depend on the id, not the object: the parent rebuilds `initial` every
    // render (normalizeSession), and reseeding mid-edit would wipe typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const { data: coursesRes } = useQuery({
    queryKey: ["courses", "ilt-options"],
    queryFn: () => apiGet<any[]>("/courses", { perPage: 100 }),
    enabled: open,
  });
  const courses: any[] = coursesRes?.data ?? [];

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Title is required");
    if (instructorId == null) return setError("Please select an instructor");
    if (!startLocal || !endLocal) return setError("Start time and end time are required");
    const start = new Date(startLocal);
    const end = new Date(endLocal);
    if (end <= start) return setError("End time must be after start time");
    const max = maxAttendees.trim() === "" ? null : Number(maxAttendees);
    if (max != null && (!Number.isInteger(max) || max <= 0)) {
      return setError("Max attendees must be a positive whole number");
    }

    const body = {
      title: title.trim(),
      description: description.trim() || null,
      instructor_id: instructorId,
      course_id: courseId || null,
      location: location.trim() || null,
      meeting_url: meetingUrl.trim() || null,
      materials_url: materialsUrl.trim() || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      max_attendees: max,
    };

    setSaving(true);
    try {
      const res = isEdit
        ? await apiPut(`/ilt/sessions/${initial!.id}`, body)
        : await apiPost("/ilt/sessions", body);
      if (res.success) {
        onSaved();
        onClose();
      } else {
        setError(res.error?.message ?? "Failed to save session");
      }
    } catch (err: any) {
      setError(apiErrorMessage(err, "Failed to save session"));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Session" : "Create ILT Session"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Effective Communication Workshop"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What will this session cover?"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Instructor <span className="text-red-500">*</span>
            </label>
            <InstructorPicker
              value={instructorId}
              valueName={instructorName}
              onChange={(id, name) => {
                setInstructorId(id);
                setInstructorName(name);
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Linked Course (optional)
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className={inputClass}
            >
              <option value="">-- No linked course --</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Conference Room B"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Max Attendees</label>
              <input
                type="number"
                min={1}
                value={maxAttendees}
                onChange={(e) => setMaxAttendees(e.target.value)}
                placeholder="Unlimited"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Meeting URL</label>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.example.com/..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Materials URL</label>
            <input
              type="url"
              value={materialsUrl}
              onChange={(e) => setMaterialsUrl(e.target.value)}
              placeholder="https://docs.example.com/..."
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
