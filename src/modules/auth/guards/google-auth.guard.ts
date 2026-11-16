import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OAuthStateStore } from '../strategies/oauth-state.store';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    // O tipo de conta é validado contra uma allowlist e vai para o cookie
    // assinado do fluxo; o parâmetro `state` enviado ao Google é sempre um
    // valor aleatório (v5.0.0-10.1.2).
    const accountType = OAuthStateStore.normalizeAccountType(req.query?.role);
    return { state: { accountType }, session: false };
  }
}
