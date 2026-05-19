import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../shared/app-config.service';
import { DealerJwtPayload, DealerRequestContext } from './request-context';

type ExpressRequest = {
  headers: Record<string, string | string[] | undefined>;
  dealerContext?: DealerRequestContext;
};

@Injectable()
export class DealerGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ExpressRequest>();
    const token = this.getToken(req.headers.authorization);

    try {
      const payload = await this.jwtService.verifyAsync<DealerJwtPayload>(token, {
        secret: this.appConfig.jwtDealerSecret,
      });

      if (payload.type !== 'dealer' || !payload.sub || !payload.organization_id) {
        throw new UnauthorizedException('Invalid dealer token payload');
      }

      req.dealerContext = {
        organizationId: payload.organization_id,
        dealerId: payload.sub,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid dealer token');
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
