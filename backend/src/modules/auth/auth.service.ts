import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../shared/database.service';
import { AppConfigService } from '../../shared/app-config.service';
import { LoginDto } from './auth.dto';
import { UserRole } from '../security/request-context';

type UserRow = {
  id: string;
  organization_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  password_hash: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
  ) {}

  async login(input: LoginDto): Promise<{
    accessToken: string;
    user: {
      id: string;
      organization_id: string;
      role: UserRole;
      name: string;
      email: string;
    };
  }> {
    const email = input.email.trim().toLowerCase();

    let result: { rows: UserRow[] };
    try {
      result = await this.db.query<UserRow>(
        `
        SELECT u.id, u.organization_id, u.role, u.full_name, u.email, u.password_hash
        FROM users u
        INNER JOIN organizations o ON o.id = u.organization_id
        WHERE LOWER(u.email) = $1
          AND u.is_active = TRUE
          AND u.is_deleted = FALSE
          AND o.is_active = TRUE
          AND o.is_deleted = FALSE
        LIMIT 1
        `,
        [email],
      );
    } catch (error: unknown) {
      if (this.isDatabaseConnectionError(error)) {
        throw new ServiceUnavailableException(
          'Database connection failed. Verify DATABASE_URL user/password/host and that PostgreSQL is running.',
        );
      }

      throw error;
    }

    const user = result.rows[0];
    if (!user || !this.verifyPassword(input.password, user.password_hash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        organization_id: user.organization_id,
        role: user.role,
      },
      {
        secret: this.appConfig.jwtUserSecret,
        expiresIn: '8h',
      },
    );

    return {
      accessToken,
      user: {
        id: user.id,
        organization_id: user.organization_id,
        role: user.role,
        name: user.full_name,
        email: user.email,
      },
    };
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const normalizedStored = storedHash.trim();
    const separatorIndex = normalizedStored.indexOf(':');
    if (separatorIndex === -1) {
      return password === normalizedStored;
    }

    const salt = normalizedStored.slice(0, separatorIndex);
    const expectedHex = normalizedStored.slice(separatorIndex + 1);

    if (!salt || !expectedHex) {
      return false;
    }

    const derivedHex = scryptSync(password, salt, 64).toString('hex');
    const expected = Buffer.from(expectedHex, 'hex');
    const derived = Buffer.from(derivedHex, 'hex');

    if (expected.length !== derived.length) {
      return false;
    }

    return timingSafeEqual(expected, derived);
  }

  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private isDatabaseConnectionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = (error as { code?: unknown }).code;
    if (typeof code !== 'string') {
      return false;
    }

    return (
      code === '28P01' ||
      code === '3D000' ||
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT'
    );
  }
}
