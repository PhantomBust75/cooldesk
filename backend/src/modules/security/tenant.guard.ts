import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../shared/database.service';
import { AppConfigService } from '../../shared/app-config.service';
import { RequestContext as TenantRequestContext, UserJwtPayload } from './request-context';

type ExpressRequest = {
  headers: Record<string, string | string[] | undefined>;
  context?: TenantRequestContext;
};

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
    private readonly appConfig: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ExpressRequest>();
    const token = this.getToken(req.headers.authorization);
    const payload = await this.verifyTenantToken(token);

    const orgResult = await this.db.query<{ id: string }>(
      `
      SELECT id
      FROM organizations
      WHERE id = $1
        AND is_active = TRUE
        AND is_deleted = FALSE
      LIMIT 1
      `,
      [payload.organization_id],
    );

    if (orgResult.rowCount === 0) {
      throw new UnauthorizedException('Organization inactive or not found');
    }

    req.context = {
      organizationId: payload.organization_id,
      userId: payload.sub,
      role: payload.role,
    };

    return true;
  }

  private getToken(authorization: string | string[] | undefined): string {
    const authValue = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!authValue?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return authValue.slice('Bearer '.length);
  }

  private async verifyTenantToken(token: string): Promise<UserJwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<UserJwtPayload>(token, {
        secret: this.appConfig.jwtUserSecret,
      });
      if (!payload.organization_id || !payload.sub || !payload.role) {
        throw new UnauthorizedException('Invalid tenant token payload');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid tenant token');
    }
  }
}
