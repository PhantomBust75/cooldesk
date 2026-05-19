import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { RequestContext, UserRole } from './request-context';

type ExpressRequest = {
  context?: RequestContext;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (allowedRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<ExpressRequest>();
    if (!req.context?.role) {
      throw new ForbiddenException('Missing role context');
    }

    if (!allowedRoles.includes(req.context.role)) {
      throw new ForbiddenException('Role is not allowed');
    }

    return true;
  }
}
