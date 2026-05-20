import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PoolClient } from 'pg';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../shared/database.service';
import { AppConfigService } from '../../shared/app-config.service';
import {
  CreatePlatformOrganizationDto,
  UpdateOrganizationStatusDto,
} from './platform-organizations.dto';

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
};

// TODO | IMPORTANT: Move default owner values to config or environment variables
const DEFAULT_OWNER_EMAIL = 'admin@email.com';
const DEFAULT_OWNER_FULL_NAME = 'Admin Owner';
const DEFAULT_OWNER_PASSWORD = 'password';

@Injectable()
export class PlatformOrganizationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
  ) {}

  async platformLogin(email: string, password: string): Promise<{ accessToken: string }> {
    const result = await this.db.query<{ id: string; password_hash: string }>(
      `SELECT id, password_hash FROM platform_admins WHERE email = LOWER($1) AND is_active = TRUE LIMIT 1`,
      [email.trim().toLowerCase()],
    );

    const admin = result.rows[0];
    if (!admin || !this.verifyPassword(password, admin.password_hash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: admin.id, type: 'platform_admin' },
      { secret: this.appConfig.jwtPlatformSecret, expiresIn: '8h' },
    );

    return { accessToken };
  }

  async createOrganization(input: CreatePlatformOrganizationDto): Promise<{ organizationId: string }> {
    return this.db.withTransaction(async (client) => {
      const organizationId = await this.insertOrganization(client, input.name, input.slug);
      await client.query('SELECT seed_system_config($1)', [organizationId]);
      await this.insertOwnerUser(client, organizationId, input);
      return { organizationId };
    });
  }

  async updateOrganizationStatus(
    organizationId: string,
    input: UpdateOrganizationStatusDto,
  ): Promise<void> {
    const result = await this.db.query(
      `
      UPDATE organizations
      SET is_active = $2,
          updated_at = NOW()
      WHERE id = $1
        AND is_deleted = FALSE
      `,
      [organizationId, input.isActive],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Organization not found');
    }
  }

  async listOrganizations(): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      isActive: boolean;
      userCount: number;
      jobCount: number;
      createdAt: string;
    }>
  > {
    const result = await this.db.query<
      OrganizationRow & { user_count: string; job_count: string }
    >(
      `
      SELECT
        o.id,
        o.name,
        o.slug,
        o.is_active,
        o.is_deleted,
        o.created_at,
        COALESCE(u.user_count, 0)::text AS user_count,
        '0'::text AS job_count
      FROM organizations o
      LEFT JOIN (
        SELECT organization_id, COUNT(*) AS user_count
        FROM users
        WHERE is_deleted = FALSE
        GROUP BY organization_id
      ) u ON u.organization_id = o.id
      WHERE o.is_deleted = FALSE
      ORDER BY o.created_at DESC
      `,
    );

    return result.rows.map((row: OrganizationRow & { user_count: string; job_count: string }) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      isActive: row.is_active,
      userCount: Number.parseInt(row.user_count, 10),
      jobCount: Number.parseInt(row.job_count, 10),
      createdAt: row.created_at,
    }));
  }

  private async insertOrganization(client: PoolClient, name: string, slug: string): Promise<string> {
    const result = await client.query<{ id: string }>(
      `
      INSERT INTO organizations (name, slug)
      VALUES ($1, $2)
      RETURNING id
      `,
      [name, slug],
    );

    return result.rows[0].id;
  }

  private async insertOwnerUser(
    client: PoolClient,
    organizationId: string,
    input: CreatePlatformOrganizationDto,
  ): Promise<void> {
    const owner = this.resolveOwnerCredentials(input);

    await client.query(
      `
      INSERT INTO users (
        organization_id,
        email,
        full_name,
        role,
        password_hash,
        is_active,
        is_deleted
      )
      VALUES ($1, $2, $3, 'owner', $4, TRUE, FALSE)
      `,
      [organizationId, owner.email, owner.fullName, owner.passwordHash],
    );
  }

  private resolveOwnerCredentials(input: CreatePlatformOrganizationDto): {
    email: string;
    fullName: string;
    passwordHash: string;
  } {
    const email = input.ownerEmail?.trim() || DEFAULT_OWNER_EMAIL;
    const fullName = input.ownerFullName?.trim() || DEFAULT_OWNER_FULL_NAME;

    if (input.ownerPasswordHash?.trim()) {
      return {
        email,
        fullName,
        passwordHash: input.ownerPasswordHash.trim(),
      };
    }

    const plainPassword = input.ownerPassword?.trim() || DEFAULT_OWNER_PASSWORD;
    return {
      email,
      fullName,
      passwordHash: this.hashPassword(plainPassword),
    };
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const sep = storedHash.indexOf(':');
    if (sep === -1) return password === storedHash;
    const salt = storedHash.slice(0, sep);
    const expectedHex = storedHash.slice(sep + 1);
    const derived = Buffer.from(scryptSync(password, salt, 64).toString('hex'), 'hex');
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  }
}
