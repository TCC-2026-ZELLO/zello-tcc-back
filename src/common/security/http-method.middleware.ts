import { NextFunction, Request, Response } from 'express';

const ALLOWED_METHODS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

/** Recusa métodos HTTP que a API não usa, como TRACE e CONNECT (v5.0.0-3.5.3). */
export function httpMethodAllowlist(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!ALLOWED_METHODS.has(req.method.toUpperCase())) {
    res.setHeader('Allow', Array.from(ALLOWED_METHODS).join(', '));
    res.status(405).json({
      statusCode: 405,
      message: 'Método não permitido.',
      error: 'Method Not Allowed',
    });
    return;
  }
  next();
}

/** Impede cache de respostas da API, que podem conter dados pessoais (v5.0.0-14.3.2). */
export function noStore(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}
