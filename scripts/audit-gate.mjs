// v5.0.0-15.2.1: gate de SCA do pipeline. Falha com qualquer vulnerabilidade
// crítica e com vulnerabilidade alta que não esteja na lista de risco aceito.
// A lista é revisada a cada execução: entradas que deixam de aparecer no
// relatório são informadas para remoção.
import { execFileSync } from 'node:child_process';

// Cadeia transitiva do whatsapp-web.js (extract-zip 2.0.1, sem versão corrigida
// publicada). O extract-zip só é usado pelo Puppeteer para descompactar o
// navegador baixado; o download está desativado (.puppeteerrc.cjs) e o
// recurso de WhatsApp fica desligado em produção (WHATSAPP_ENABLED=false).
// Decisão documentada em docs/security/ESPECIFICACAO_DIRETRIZES_SEGURANCA_ZELLO.md (V15.1.1).
const ACCEPTED_HIGH = new Set([
  'extract-zip',
  '@puppeteer/browsers',
  'puppeteer',
  'puppeteer-core',
  'whatsapp-web.js',
]);

let raw;
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  // npm audit retorna código != 0 quando encontra vulnerabilidades.
  raw = err.stdout;
}

const report = JSON.parse(raw);
const vulns = Object.values(report.vulnerabilities ?? {});
const blocking = vulns.filter(
  (v) =>
    v.severity === 'critical' ||
    (v.severity === 'high' && !ACCEPTED_HIGH.has(v.name)),
);
const accepted = vulns.filter(
  (v) => v.severity === 'high' && ACCEPTED_HIGH.has(v.name),
);
const stale = [...ACCEPTED_HIGH].filter(
  (name) => !accepted.some((v) => v.name === name),
);

console.log('Resumo:', JSON.stringify(report.metadata?.vulnerabilities ?? {}));
for (const v of accepted) console.log(`ACEITO   high ${v.name}`);
for (const name of stale)
  console.log(`::warning::Risco aceito "${name}" não aparece mais no relatório; remova da lista.`);
for (const v of blocking)
  console.log(`::error::${v.severity} ${v.name} (${v.range ?? ''})`);

if (blocking.length > 0) {
  console.error(`${blocking.length} vulnerabilidade(s) bloqueante(s).`);
  process.exit(1);
}
console.log('Gate de SCA aprovado.');
