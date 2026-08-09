import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'], // Admin tem todas as permissoes
  operador: [
    'dashboard:read',
    'tachographs:read',
    'tachographs:update',
    'inspections:read',
    'inspections:update',
    'vehicles:read',
    'vehicles:update',
    'drivers:read',
  ],
  motorista: [
    'vehicles:read',
    'tachographs:create',
    'tachographs:read-own',
    'inspections:create',
    'inspections:read-own',
    'drivers:read-own',
  ],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.role) {
      return false;
    }

    const userRole = user.role.toLowerCase();
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];
    if (userPermissions.includes('*')) {
      return true;
    }

    return requiredPermissions.some((permission) => {
      if (userPermissions.includes(permission)) {
        return true;
      }

      if (permission === 'drivers:read-own' || permission === 'tachographs:read-own' || permission === 'inspections:read-own') {
        const paramId = request.params.id || request.params.driverId;
        if (paramId && +paramId === user.userId) {
          return true;
        }
      }

      const [resource] = permission.split(':');
      if (userPermissions.includes(`${resource}:*`)) {
        return true;
      }
      return false;
    });
  }
}
