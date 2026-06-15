import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Pencil,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { apiGet, apiPost } from "@/api/client";
import { useAuthStore, isAdminRole } from "@/lib/auth-store";
import {
  IltSession,
  normalizeSession,
  isSessionFull,
  apiErrorMessage,
  SessionStatusBadge,
  AttendanceStatusBadge,
  FullBadge,
  ConfirmModal,
  SessionFormModal,
} from "./ilt-shared";

interface AttendanceRow {
  id: string;
  user_id: number;
  user_name: string;
  user_email: string | null;
  status: string;
  checked_in_at: string | null;
}

interface SessionStats {
  session_id: string;
  registered_count: number;
  attended_count: number;
  absent_count: number;
  excused_count: number;
  attendance_rate: number;
  max_attendees: number | null;
  capacity_utilization: number | null;
}

const MARK_OPTIONS = ["attended", "absent", "excused"] as const;

export function ILTSessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = isAdminRole(user?.role);

  const [showEdit, setShowEdit] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "complete" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [markingUserId, setMarkingUserId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ilt", "session", id],
    queryFn: () => apiGet<any>(`/ilt/sessions/${id}`),
    enabled: !!id,
    retry: false,
  });

  const { data: statsRes } = useQuery({
    queryKey: ["ilt", "session", id, "stats"],
    queryFn: () => apiGet<SessionStats>(`/ilt/sessions/${id}/stats`),
    enabled: !!id && isAdmin,
    retry: false,
  });
  const stats = statsRes?.data;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
        <CalendarDays className="h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Session not found</h3>
        <p className="mt-1 text-sm text-gray-500">
          This session may have been removed or the link is incorrect.
        </p>
        <Link
          to="/ilt"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to ILT Sessions
        </Link>
      </div>
    );
  }

  const session: IltSession = normalizeSession(data.data);
  const attendance: AttendanceRow[] = data.data.attendance ?? [];
  const full = isSessionFull(session);
  const myRow = user
    ? attendance.find((a) => a.user_id === user.empcloudUserId)
    : undefined;
  const isRegistered = !!myRow;
  const canRegister = session.status === "scheduled" && !isRegistered && !full;
  const canUnregister = isRegistered && session.status === "scheduled";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ilt"] });
  };

  const handleRegister = async () => {
    setRegisterBusy(true);
    try {
      const res = await apiPost(`/ilt/sessions/${id}/register`);
      if (res.success) {
        toast.success("Successfully registered!");
        refresh();
      } else {
        toast.error(res.error?.message ?? "Registration failed");
      }
    } catch (err: any) {
      toast.error(apiErrorMessage(err, "Registration failed"));
    } finally {
      setRegisterBusy(false);
    }
  };

  const handleUnregister = async () => {
    setRegisterBusy(true);
    try {
      const res = await apiPost(`/ilt/sessions/${id}/unregister`);
      if (res.success) {
        toast.success("Registration cancelled");
        refresh();
      } else {
        toast.error(res.error?.message ?? "Failed to unregister");
      }
    } catch (err: any) {
      toast.error(apiErrorMessage(err, "Failed to unregister"));
    } finally {
      setRegisterBusy(false);
    }
  };

  const handleSessionAction = async () => {
    if (!confirmAction) return;
    setActionBusy(true);
    try {
      const res = await apiPost(`/ilt/sessions/${id}/${confirmAction}`);
      if (res.success) {
        toast.success(confirmAction === "cancel" ? "Session cancelled" : "Session completed");
        setConfirmAction(null);
        refresh();
      } else {
        toast.error(res.error?.message ?? "Action failed");
      }
    } catch (err: any) {
      toast.error(apiErrorMessage(err, "Action failed"));
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkAttendance = async (userId: number, status: string) => {
    setMarkingUserId(userId);
    try {
      const res = await apiPost(`/ilt/sessions/${id}/attendance`, {
        attendance: [{ user_id: userId, status }],
      });
      if (res.success) {
        toast.success("Attendance updated");
        refresh();
      } else {
        toast.error(res.error?.message ?? "Failed to mark attendance");
      }
    } catch (err: any) {
      toast.error(apiErrorMessage(err, "Failed to mark attendance"));
    } finally {
      setMarkingUserId(null);
    }
  };

  const capacityPct =
    session.maxAttendees != null && session.maxAttendees > 0
      ? Math.min(100, Math.round((session.enrolledCount / session.maxAttendees) * 100))
      : null;

  const canEdit = isAdmin && session.status !== "cancelled" && session.status !== "completed";
  const canCancel = isAdmin && session.status !== "cancelled" && session.status !== "completed";
  const canComplete =
    isAdmin && (session.status === "scheduled" || session.status === "in_progress");

  return (
    <div className="space-y-6">
      <Link
        to="/ilt"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to ILT Sessions
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{session.title}</h1>
              <SessionStatusBadge status={session.status} />
              {full && session.status === "scheduled" && <FullBadge />}
              {myRow && <AttendanceStatusBadge status={myRow.status} />}
            </div>
            {session.description && (
              <p className="mt-2 text-sm text-gray-600">{session.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canRegister && (
              <button
                onClick={handleRegister}
                disabled={registerBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition"
              >
                {registerBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Register
              </button>
            )}
            {canUnregister && (
              <button
                onClick={handleUnregister}
                disabled={registerBusy}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {registerBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserMinus className="h-4 w-4" />
                )}
                Unregister
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setShowEdit(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => setConfirmAction("complete")}
                className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setConfirmAction("cancel")}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition"
              >
                <XCircle className="h-4 w-4" />
                Cancel Session
              </button>
            )}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-2 text-gray-600">
            <UserCheck className="h-4 w-4 shrink-0 text-gray-400" />
            <span>
              Instructor:{" "}
              <span className="font-medium text-gray-900">
                {session.instructorName ?? "—"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4 shrink-0 text-gray-400" />
            <span>
              {dayjs(session.startTime).format("ddd, MMM D, YYYY h:mm A")}
              {session.endTime && ` – ${dayjs(session.endTime).format("h:mm A")}`}
            </span>
          </div>
          {session.location && (
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
              <span>{session.location}</span>
            </div>
          )}
          {session.meetingUrl && (
            <div className="flex items-center gap-2 text-gray-600">
              <LinkIcon className="h-4 w-4 shrink-0 text-gray-400" />
              <a
                href={session.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-brand-600 hover:underline"
              >
                Join meeting
              </a>
            </div>
          )}
          {session.materialsUrl && (
            <div className="flex items-center gap-2 text-gray-600">
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <a
                href={session.materialsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-brand-600 hover:underline"
              >
                Session materials
              </a>
            </div>
          )}
        </dl>

        {/* Capacity */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-gray-600">
              <Users className="h-4 w-4 text-gray-400" />
              {session.enrolledCount}/{session.maxAttendees ?? "∞"} enrolled
            </span>
            {capacityPct != null && (
              <span className="text-xs font-medium text-gray-500">{capacityPct}% full</span>
            )}
          </div>
          {capacityPct != null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${
                  capacityPct >= 100 ? "bg-amber-500" : "bg-brand-600"
                }`}
                style={{ width: `${capacityPct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Admin stats strip */}
      {isAdmin && stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            { label: "Registered", value: stats.registered_count, color: "text-gray-900" },
            { label: "Attended", value: stats.attended_count, color: "text-green-700" },
            { label: "Absent", value: stats.absent_count, color: "text-red-700" },
            { label: "Excused", value: stats.excused_count, color: "text-amber-700" },
            { label: "Attendance Rate", value: `${stats.attendance_rate}%`, color: "text-brand-600" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm"
            >
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Roster */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Roster ({attendance.length})
          </h2>
        </div>
        {attendance.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">
            No one has registered for this session yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Checked In
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Mark Attendance
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {attendance.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-6 py-3 font-medium text-gray-900">
                      {row.user_name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-gray-500">
                      {row.user_email ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3">
                      <AttendanceStatusBadge status={row.status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-gray-500">
                      {row.checked_in_at
                        ? dayjs(row.checked_in_at).format("MMM D, YYYY h:mm A")
                        : "—"}
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={MARK_OPTIONS.includes(row.status as any) ? row.status : ""}
                            disabled={markingUserId === row.user_id}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleMarkAttendance(row.user_id, e.target.value);
                              }
                            }}
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                          >
                            <option value="" disabled>
                              Mark as...
                            </option>
                            <option value="attended">Attended</option>
                            <option value="absent">Absent</option>
                            <option value="excused">Excused</option>
                          </select>
                          {markingUserId === row.user_id && (
                            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      <SessionFormModal
        open={showEdit}
        initial={session}
        onClose={() => setShowEdit(false)}
        onSaved={() => {
          toast.success("Session updated");
          refresh();
        }}
      />

      {/* Cancel / Complete confirm modals */}
      <ConfirmModal
        open={confirmAction === "cancel"}
        title="Cancel this session?"
        message={`"${session.title}" will be cancelled and all registered attendees will be notified. This cannot be undone.`}
        confirmLabel="Cancel Session"
        tone="danger"
        busy={actionBusy}
        onConfirm={handleSessionAction}
        onClose={() => setConfirmAction(null)}
      />
      <ConfirmModal
        open={confirmAction === "complete"}
        title="Mark session as completed?"
        message={`"${session.title}" will be marked as completed. Make sure attendance has been recorded first.`}
        confirmLabel="Complete Session"
        busy={actionBusy}
        onConfirm={handleSessionAction}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  );
}

export default ILTSessionDetailPage;
