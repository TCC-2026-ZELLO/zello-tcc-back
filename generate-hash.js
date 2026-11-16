/**
 * Utilitário de linha de comando para gerar um hash bcrypt (custo 10).
 *
 * v5.0.0-6.3.2 / 13.3.1: a versão anterior trazia uma senha fixa no código e a
 * imprimia no terminal. Agora a senha é lida da entrada padrão e nunca é
 * exibida nem gravada. Não há conta administrativa padrão no Zello: o primeiro
 * administrador é definido por BOOTSTRAP_ADMIN_EMAIL (ver docs/security).
 *
 * Uso: node generate-hash.js < arquivo-com-a-senha
 *      printf '%s' "$SENHA" | node generate-hash.js
 */
const bcrypt = require('bcrypt');

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');

  if (password.length < 8) {
    console.error('A senha precisa ter pelo menos 8 caracteres.');
    process.exit(1);
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    console.error('A senha precisa ter no máximo 72 bytes (limite do bcrypt).');
    process.exit(1);
  }

  process.stdout.write(`${await bcrypt.hash(password, 10)}\n`);
}

main().catch(() => {
  console.error('Falha ao gerar o hash.');
  process.exit(1);
});
