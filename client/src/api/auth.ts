import axiosInstance from "./axiosInstance";
import type { UserOut, TokenResponse, RegisterPayload, LoginPayload } from "../types";

// ── 4.1  Auth API functions ────────────────────────────────────────────────

/**
 * Register a new user.
 * POST /api/auth/register
 * Returns { access_token, token_type, user }
 */
export async function register(payload: RegisterPayload): Promise<TokenResponse> {
  const { data } = await axiosInstance.post<TokenResponse>("/api/auth/register", payload);
  return data;
}

/**
 * Log in with email + password.
 * POST /api/auth/login
 * Returns { access_token, token_type, user }
 */
export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const { data } = await axiosInstance.post<TokenResponse>("/api/auth/login", payload);
  return data;
}

/**
 * Fetch the currently authenticated user.
 * GET /api/auth/me  (requires Bearer token)
 */
export async function getMe(): Promise<UserOut> {
  const { data } = await axiosInstance.get<UserOut>("/api/auth/me");
  return data;
}
