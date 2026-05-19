import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../shared/app-config.service';
import { PlatformAdminJwtPayload } from './request-context';

type ExpressRequest = {
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ExpressRequest>();
    const token = this.getToken(req.headers.authorization);

    try {
      const payload = await this.jwtService.verifyAsync<PlatformAdminJwtPayload>(token, {
        secret: this.appConfig.jwtPlatformSecret,
      });

      if (payload.type !== 'platform_admin' || !payload.sub) {
        throw new UnauthorizedException('Invalid platform token payload');
      }

      return true;
    } catch {
      throw new UnauthorizedException('Invalid platform admin token');
    }
  }

  private getToken(authorization: string | string[] | undefined): string {
    const authValue = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!authValue?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return authValue.slice('Bearer '.length);
  }
}
