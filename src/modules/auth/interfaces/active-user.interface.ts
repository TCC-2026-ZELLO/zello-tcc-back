export interface ActiveUser {
  id: string;
  email: string;
  roles: string[];
  /** Identificador da sessão do token de acesso (claim `sid`). */
  sessionId?: string;
}
