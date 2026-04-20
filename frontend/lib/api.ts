import {
  AnalysisResponse,
  AuthActionResponse,
  AuthLoginRequest,
  AuthTokenResponse,
  AuthSignupRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  HealthProfile,
  HealthRiskInsightsResponse,
  MedicationAdherenceStatus,
  NoteFileAnalysisResponse,
  NoteFollowUpRequest,
  NoteFollowUpResponse,
  NoteInterpretRequest,
  NoteInterpretationResponse,
  ReportRead,
  ReportSavePayload,
  ResetPasswordConfirmRequest,
  RiskInsightRequest,
  SymptomAnalyzeRequest,
  SymptomIntakeInitialResponse,
  SymptomIntakeUpdateRequest,
  UserRead,
  UpdateEmailRequest,
  UpdateNameRequest,
  UpdatePasswordRequest
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "healthsignal_access_token";
const LEGACY_TOKEN_KEYS = ["access_token"];

function readTokenFromStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      return token;
    }

    for (const legacyKey of LEGACY_TOKEN_KEYS) {
      const legacyToken = localStorage.getItem(legacyKey);
      if (legacyToken) {
        localStorage.setItem(TOKEN_KEY, legacyToken);
        localStorage.removeItem(legacyKey);
        return legacyToken;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  return readTokenFromStorage();
}

export function saveToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }
  clearToken();
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
  for (const legacyKey of LEGACY_TOKEN_KEYS) {
    localStorage.removeItem(legacyKey);
  }
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

type RequestOptions = RequestInit & {
  authRequired?: boolean;
};

function buildAuthHeaders(init?: RequestOptions) {
  const token = getToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  if (init?.authRequired && !token) {
    throw new ApiError("Please log in to continue.", 401);
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

function handleUnauthorized(status: number) {
  if (status === 401) {
    clearToken();
  }
}

async function request<TResponse>(path: string, init?: RequestOptions): Promise<TResponse> {
  const headers = buildAuthHeaders(init);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    handleUnauthorized(response.status);
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

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

async function requestForm<TResponse>(path: string, formData: FormData, init?: RequestOptions): Promise<TResponse> {
  const token = getToken();
  const headers = new Headers();

  if (init?.authRequired && !token) {
    throw new ApiError("Please log in to continue.", 401);
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData
  });

  if (!response.ok) {
    handleUnauthorized(response.status);
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

export function postAuthJSON<TRequest, TResponse>(path: string, body: TRequest) {
  return request<TResponse>(path, {
    method: "POST",
    body: JSON.stringify(body),
    authRequired: true
  });
}

export function getJSON<TResponse>(path: string) {
  return request<TResponse>(path, {
    method: "GET"
  });
}

export function getAuthJSON<TResponse>(path: string) {
  return request<TResponse>(path, {
    method: "GET",
    authRequired: true
  });
}

export function signup(payload: AuthSignupRequest) {
  return postJSON<AuthSignupRequest, UserRead>("/api/auth/signup", payload);
}

export function login(payload: AuthLoginRequest) {
  return postJSON<AuthLoginRequest, AuthTokenResponse>("/api/auth/login", payload);
}

export function forgotPassword(payload: ForgotPasswordRequest) {
  return postJSON<ForgotPasswordRequest, ForgotPasswordResponse>("/api/auth/forgot-password", payload);
}

export function resetPassword(payload: ResetPasswordConfirmRequest) {
  return postJSON<ResetPasswordConfirmRequest, AuthActionResponse>("/api/auth/reset-password", payload);
}

export function verifyEmailToken(token: string) {
  return postJSON<{ token: string }, AuthActionResponse>("/api/auth/verify-email", { token });
}

export function resendVerificationEmail(payload: ForgotPasswordRequest) {
  return postJSON<ForgotPasswordRequest, AuthActionResponse>("/api/auth/verification/resend", payload);
}

export function getCurrentUser() {
  return getAuthJSON<UserRead>("/api/auth/me");
}

export function updateCurrentUserName(payload: UpdateNameRequest) {
  return request<UserRead>("/api/auth/me/name", {
    method: "PUT",
    body: JSON.stringify(payload),
    authRequired: true
  });
}

export function updateCurrentUserEmail(payload: UpdateEmailRequest) {
  return request<UserRead>("/api/auth/me/email", {
    method: "PUT",
    body: JSON.stringify(payload),
    authRequired: true
  });
}

export function updateCurrentUserPassword(payload: UpdatePasswordRequest) {
  return request<void>("/api/auth/me/password", {
    method: "PUT",
    body: JSON.stringify(payload),
    authRequired: true
  });
}

export function analyzeSymptoms(payload: SymptomAnalyzeRequest) {
  return postAuthJSON<SymptomAnalyzeRequest, AnalysisResponse>("/api/analyze/symptoms", payload);
}

export function startSymptomIntake(payload: SymptomAnalyzeRequest) {
  return postAuthJSON<SymptomAnalyzeRequest, SymptomIntakeInitialResponse>("/api/analyze/symptoms/intake", payload);
}

export function updateSymptomIntake(payload: SymptomIntakeUpdateRequest) {
  return postAuthJSON<SymptomIntakeUpdateRequest, SymptomIntakeInitialResponse>("/api/analyze/symptoms/intake/update", payload);
}

export function analyzeNotes(payload: NoteInterpretRequest) {
  return postAuthJSON<NoteInterpretRequest, NoteInterpretationResponse>("/api/analyze/notes", payload);
}

export function analyzeNoteFollowUp(payload: NoteFollowUpRequest) {
  return postAuthJSON<NoteFollowUpRequest, NoteFollowUpResponse>("/api/analyze/note-follow-up", payload);
}

export function analyzeNoteFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return requestForm<NoteFileAnalysisResponse>("/api/analyze/note-file", formData, { authRequired: true });
}

export function analyzeRisk(payload: RiskInsightRequest) {
  return postAuthJSON<RiskInsightRequest, AnalysisResponse>("/api/analyze/risk", payload);
}

export function listReports() {
  return getAuthJSON<ReportRead[]>("/api/reports");
}

export function getReport(reportId: number) {
  return getAuthJSON<ReportRead>(`/api/reports/${reportId}`);
}

export function saveReport(payload: ReportSavePayload) {
  return postAuthJSON<ReportSavePayload, ReportRead>("/api/reports", payload);
}

export function getHealthProfile() {
  return getAuthJSON<HealthProfile>("/api/profile/health");
}

export function upsertHealthProfile(payload: HealthProfile) {
  return request<HealthProfile>("/api/profile/health", {
    method: "PUT",
    body: JSON.stringify(payload),
    authRequired: true
  });
}

export function generateHealthInsights() {
  return postAuthJSON<Record<string, never>, HealthRiskInsightsResponse>("/api/profile/health/insights", {});
}


export function updateTodayMedicationStatus(payload: { medication_id: string; status: MedicationAdherenceStatus }) {
  return request<HealthProfile>("/api/profile/health/medications/today", {
    method: "PUT",
    body: JSON.stringify(payload),
    authRequired: true
  });
}
