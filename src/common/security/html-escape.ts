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
  // Objetos são serializados como JSON (nunca "[object Object]") antes de codificar.
  let text: string;
  if (typeof value === 'string') text = value;
  else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    text = value.toString();
  else if (typeof value === 'object') text = JSON.stringify(value);
  else text = '';
  return text.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char]);
}
