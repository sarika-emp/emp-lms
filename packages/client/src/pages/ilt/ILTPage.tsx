import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  MapPin,
  Link as LinkIcon,
  Users,
  Loader2,
  Clock,
  UserCheck,
  Plus,
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { apiGet, apiPost } from "@/api/client";
import { useAuthStore, isAdminRole } from "@/lib/auth-store";
import { formatDateTime, formatTime } from "@/lib/utils";
import {
  IltSession,
  normalizeSession,
  isSessionFull,
  apiErrorMessage,
  SessionStatusBadge,
  AttendanceStatusBadge,
  FullBadge,
  SessionFormModal,
} from "./ilt-shared";

type Tab = "upcoming" | "past" | "my";

export default function ILTPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [showCreate, setShowCreate] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = isAdminRole(user?.role);

  // Stable "now" so react-query keys don't churn on every render
  const nowIso = useMemo(() => new Date().toISOString(), []);

  const { data, isLoading } = useQuery({
    queryKey: ["ilt", "list", activeTab, nowIso],
    queryFn: () => {
      if (activeTab === "my") {
        return apiGet<any[]>("/ilt/my/sessions", { limit: 100 });
      }
      if (activeTab === "past") {
        return apiGet<any[]>("/ilt", {
          end_date: nowIso,
          sort: "start_time",
          order: "desc",
          limit: 100,
        });
      }
      // upcoming
      return apiGet<any[]>("/ilt", {
        status: "scheduled",
        start_date: nowIso,
        sort: "start_time",
        order: "asc",
        limit: 100,
      });
    },
  });

  // BUG-13: the Upcoming list has no per-session "registered" flag, so the
  // Register button showed even after registering. Fetch the user's registered
  // session ids and hide/disable Register for those. Invalidated by the same
  // ["ilt"] key that handleRegister invalidates, so it refreshes on register.
  const { data: myData } = useQuery({
    queryKey: ["ilt", "my-ids"],
    queryFn: () => apiGet<any[]>("/ilt/my/sessions", { limit: 200 }),
    enabled: !isAdmin,
  });
  const registeredIds = useMemo(
    () => new Set((myData?.data ?? []).map((s: any) => s.id ?? s.session_id ?? s.sessionId)),
    [myData],
  );

  const sessions: IltSession[] = (data?.data ?? []).map(normalizeSession);

  const handleRegister = async (e: React.MouseEvent, sessionId: string) => {
    // The card is wrapped in a <Link>; keep the click from navigating
    e.preventDefault();
    e.stopPropagation();
    setRegisteringId(sessionId);
    try {
      const res = await apiPost(`/ilt/sessions/${sessionId}/register`);
      if (res.success) {
        toast.success(t("ilt.registeredSuccess"));
        queryClient.invalidateQueries({ queryKey: ["ilt"] });
      } else {
        toast.error(res.error?.message ?? t("ilt.registrationFailed"));
      }
    } catch (err: any) {
      toast.error(apiErrorMessage(err, t("ilt.registrationFailed")));
    } finally {
      setRegisteringId(null);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "upcoming", label: t("ilt.tabUpcoming") },
    { key: "past", label: t("ilt.tabPast") },
    { key: "my", label: t("ilt.tabMy") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">{t("ilt.title")}</h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition"
          >
            <Plus className="h-4 w-4" />
            {t("ilt.createSession")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <CalendarDays className="h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">{t("ilt.noSessionsFound")}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === "upcoming"
              ? t("ilt.noUpcomingSessions")
              : activeTab === "past"
                ? t("ilt.noPastSessions")
                : t("ilt.noMySessions")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const full = isSessionFull(session);
            const canRegister =
              activeTab === "upcoming" &&
              session.status === "scheduled" &&
              !full &&
              !registeredIds.has(session.id); // BUG-13: hide once registered
            return (
              <Link
                key={session.id}
                to={`/ilt/${session.id}`}
                className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                    {session.title}
                  </h3>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <SessionStatusBadge status={session.status} />
                    {full && session.status === "scheduled" && <FullBadge />}
                    {activeTab === "my" && session.attendanceStatus && (
                      <AttendanceStatusBadge status={session.attendanceStatus} />
                    )}
                  </div>
                </div>

                <dl className="flex-1 space-y-2 text-sm text-gray-500">
                  {session.instructorName && (
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-gray-400" />
                      <span>{session.instructorName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>
                      {formatDateTime(session.startTime)}
                      {session.endTime && ` - ${formatTime(session.endTime!)}`}
                    </span>
                  </div>
                  {(session.location || session.meetingUrl) && (
                    <div className="flex items-center gap-2">
                      {session.location ? (
                        <>
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{session.location}</span>
                        </>
                      ) : (
                        <>
                          <LinkIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-brand-600">{t("ilt.virtualSession")}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span>
                      {t("ilt.enrolledCount", {
                        enrolled: session.enrolledCount,
                        max: session.maxAttendees ?? "∞",
                      })}
                    </span>
                  </div>
                </dl>

                {canRegister ? (
                  <button
                    onClick={(e) => handleRegister(e, session.id)}
                    disabled={registeringId === session.id}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition"
                  >
                    {registeringId === session.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {t("ilt.register")}
                  </button>
                ) : activeTab === "upcoming" && registeredIds.has(session.id) ? (
                  // BUG-13: positive confirmation once registered.
                  <span className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                    <UserCheck className="h-4 w-4" /> {t("ilt.registered")}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}

      <SessionFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => {
          toast.success(t("ilt.sessionCreated"));
          queryClient.invalidateQueries({ queryKey: ["ilt"] });
        }}
      />
    </div>
  );
}
