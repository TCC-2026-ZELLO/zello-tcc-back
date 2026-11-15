/**
 * O Puppeteer só é usado pela integração com WhatsApp, que fica desligada por
 * padrão (WHATSAPP_ENABLED=false, ver docs/security). Por isso o Chrome não é
 * baixado no `npm ci`. Para usar o WhatsApp, remova este arquivo ou instale o
 * navegador com `npx puppeteer browsers install chrome`.
 */
module.exports = {
  skipDownload: true,
};
