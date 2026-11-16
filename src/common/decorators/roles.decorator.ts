import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Qualquer usuário autenticado, independentemente do papel. Usado em rotas de
 * controllers protegidos por RolesGuard que não exigem papel específico; a
 * posse do recurso é conferida na camada de serviço.
 */
export const ALL_ROLES = ['client', 'professional', 'manager', 'admin'];
export const AnyRole = () => SetMetadata(ROLES_KEY, ALL_ROLES);
