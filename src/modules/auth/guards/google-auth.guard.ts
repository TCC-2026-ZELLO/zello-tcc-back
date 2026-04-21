import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    // Retrieve the desired role from the query parameter
    const role = req.query.role;
    
    if (role) {
      return { state: role };
    }
    return {};
  }
}
