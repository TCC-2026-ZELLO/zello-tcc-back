/**
 * Codificação de saída para contexto HTML (v5.0.0-1.2.1). Usada sempre que um
 * dado informado pelo usuário entra no corpo HTML de um e-mail.
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char]);
}
