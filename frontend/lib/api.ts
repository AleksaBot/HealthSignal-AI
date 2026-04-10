import {
  AnalysisResponse,
  AuthLoginRequest,
  AuthTokenResponse,
  AuthSignupRequest,
  NoteFileAnalysisResponse,
  NoteInterpretRequest,
  ReportRead,
  RiskInsightRequest,
  SymptomAnalyzeRequest,
  UserRead
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "healthsignal_access_token";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return Boolean(getToken());
}

function userMessageForStatus(status: number, fallback: string) {
  if (status === 401) return "Your session is invalid or expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested resource was not found.";
  if (status >= 500) return "The server is currently unavailable. Please try again shortly.";
  return fallback;
}

export function getUserErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof ApiError) {
    return userMessageForStatus(error.status, error.message || fallback);
  }

  return fallback;
}

async function request<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const fallback = userMessageForStatus(response.status, `Request failed with status ${response.status}`);
    let message = fallback;

    try {
      const data = (await response.json()) as { detail?: string };
      if (typeof data.detail === "string" && data.detail.trim().length > 0) {
        message = data.detail;
      }
    } catch {
      // keep fallback message when error body is not JSON
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as TResponse;
}

async function requestForm<TResponse>(path: string, formData: FormData): Promise<TResponse> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData
  });

  if (!response.ok) {
    const fallback = userMessageForStatus(response.status, `Request failed with status ${response.status}`);
    let message = fallback;

    try {
      const data = (await response.json()) as { detail?: string };
      if (typeof data.detail === "string" && data.detail.trim().length > 0) {
        message = data.detail;
      }
    } catch {
      // keep fallback message when error body is not JSON
    }

    throw new ApiError(message, response.status);
  }

  return (await response.json()) as TResponse;
}

export function postJSON<TRequest, TResponse>(path: string, body: TRequest) {
  return request<TResponse>(path, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function getJSON<TResponse>(path: string) {
  return request<TResponse>(path, {
    method: "GET"
  });
}

export function signup(payload: AuthSignupRequest) {
  return postJSON<AuthSignupRequest, UserRead>("/api/auth/signup", payload);
}

export function login(payload: AuthLoginRequest) {
  return postJSON<AuthLoginRequest, AuthTokenResponse>("/api/auth/login", payload);
}

export function analyzeSymptoms(payload: SymptomAnalyzeRequest) {
  return postJSON<SymptomAnalyzeRequest, AnalysisResponse>("/api/analyze/symptoms", payload);
}

export function analyzeNotes(payload: NoteInterpretRequest) {
  return postJSON<NoteInterpretRequest, AnalysisResponse>("/api/analyze/notes", payload);
}

export function analyzeNoteFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return requestForm<NoteFileAnalysisResponse>("/api/analyze/note-file", formData);
}

export function analyzeRisk(payload: RiskInsightRequest) {
  return postJSON<RiskInsightRequest, AnalysisResponse>("/api/analyze/risk", payload);
}

export function listReports() {
  return getJSON<ReportRead[]>("/api/reports");
}

export function getReport(reportId: number) {
  return getJSON<ReportRead>(`/api/reports/${reportId}`);
}
