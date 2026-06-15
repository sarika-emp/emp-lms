import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, Loader2, Info } from "lucide-react";
import { apiGet } from "@/api/client";
import { useAuthStore, isAdminRole } from "@/lib/auth-store";

interface OrgUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  designation: string | null;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Org Admin",
  hr_admin: "HR Admin",
  hr_manager: "HR Manager",
  manager: "Manager",
  employee: "Employee",
};

const ROLE_STYLES: Record<string, string> = {
  super_admin: "bg-purple-50 text-purple-700 border-purple-200",
  org_admin: "bg-indigo-50 text-indigo-700 border-indigo-200",
  hr_admin: "bg-blue-50 text-blue-700 border-blue-200",
  hr_manager: "bg-cyan-50 text-cyan-700 border-cyan-200",
  manager: "bg-teal-50 text-teal-700 border-teal-200",
  employee: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function UsersPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = isAdminRole(user?.role);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["org-users", debounced],
    queryFn: () =>
      apiGet<OrgUser[]>("/users/search", { q: debounced, limit: 50, includeSelf: 1 }),
    enabled: isAdmin,
  });
  const users = Array.isArray(data?.data) ? data!.data! : [];

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Users className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">
          The user directory is only available to administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your organization's user directory.
        </p>
      </div>

      {/* Where accounts/roles are managed */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          User accounts, roles, and permissions are managed centrally in the{" "}
          <span className="font-medium">EmpCloud admin app</span> and apply across
          all EMP modules. Instructors are assigned per session from{" "}
          <span className="font-medium">Live Training</span>.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-[11px] h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {debounced ? "No users match your search." : "No users found."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Designation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                          {(u.first_name?.[0] ?? "") + (u.last_name?.[0] ?? "")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {u.first_name} {u.last_name}
                            {u.id === user?.empcloudUserId && (
                              <span className="ml-1.5 text-xs font-normal text-gray-400">(you)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {u.designation || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          ROLE_STYLES[u.role] || ROLE_STYLES.employee
                        }`}
                      >
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
            <p className="text-sm text-gray-500">
              Showing {users.length} user{users.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
