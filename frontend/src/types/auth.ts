export const USER_ROLES = ["owner", "office_staff", "technician", "dealer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface SessionUser {
  userId: string;
  organizationId: string;
  role: UserRole;
  name?: string;
}

export interface SessionState {
  accessToken: string;
  user: SessionUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user_id?: string;
  organization_id?: string;
  role?: UserRole;
  name?: string;
  user?: {
    id?: string;
    organization_id?: string;
    role?: UserRole;
    name?: string;
  };
}
