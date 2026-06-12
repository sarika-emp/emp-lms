import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh: concurrent 401s share one /auth/refresh call
// instead of racing each other and rotating the token multiple times.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;
  try {
    // Plain axios (not `api`) so this request skips the interceptors.
    const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      `${API_BASE}/auth/refresh`,
      { refreshToken },
    );
    if (!data.success || !data.data) return null;
    localStorage.setItem("access_token", data.data.accessToken);
    localStorage.setItem("refresh_token", data.data.refreshToken);
    return data.data.accessToken;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  window.location.href = "/login?session=expired";
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestUrl: string = error.config?.url || "";
    const isAuthRoute =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/sso") ||
      requestUrl.includes("/auth/refresh");

    if (error.response?.status === 401 && !isAuthRoute) {
      const original = error.config;
      // Try a silent token refresh once per request, then replay it.
      if (!original._retry) {
        original._retry = true;
        refreshPromise = refreshPromise ?? refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api.request(original);
        }
      }
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, string[]> };
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export async function apiGet<T>(url: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
  const { data } = await api.get<ApiResponse<T>>(url, { params });
  return data;
}

export async function apiPost<T>(url: string, body?: any): Promise<ApiResponse<T>> {
  const { data } = await api.post<ApiResponse<T>>(url, body);
  return data;
}

export async function apiPut<T>(url: string, body?: any): Promise<ApiResponse<T>> {
  const { data } = await api.put<ApiResponse<T>>(url, body);
  return data;
}

export async function apiPatch<T>(url: string, body?: any): Promise<ApiResponse<T>> {
  const { data } = await api.patch<ApiResponse<T>>(url, body);
  return data;
}

export async function apiDelete<T>(url: string): Promise<ApiResponse<T>> {
  const { data } = await api.delete<ApiResponse<T>>(url);
  return data;
}
