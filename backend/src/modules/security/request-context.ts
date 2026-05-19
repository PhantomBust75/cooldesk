export type UserRole = 'owner' | 'office_staff' | 'technician';

export interface RequestContext {
  organizationId: string;
  userId: string;
  role: UserRole;
}

export interface DealerRequestContext {
  organizationId: string;
  dealerId: string;
}

export interface UserJwtPayload {
  sub: string;
  organization_id: string;
  role: UserRole;
}

export interface DealerJwtPayload {
  sub: string;
  organization_id: string;
  type: 'dealer';
}

export interface PlatformAdminJwtPayload {
  sub: string;
  type: 'platform_admin';
}
