import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

/**
 * Controle de acesso por papel (RBAC), aplicado no backend (v5.0.0-8.2.1, 8.3.1).
 *
 * Falha fechado: uma rota protegida por RolesGuard sem a anotação @Roles é
 * tratada como erro de configuração e NEGADA, em vez de liberada para qualquer
 * usuário autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este recurso.',
      );
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este recurso.',
      );
    }

    const hasRole = requiredRoles.some((role) => user.roles?.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este recurso.',
      );
    }

    return true;
  }
}
