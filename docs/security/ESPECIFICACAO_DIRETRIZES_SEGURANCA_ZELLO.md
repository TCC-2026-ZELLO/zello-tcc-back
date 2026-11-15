# Especificação de Diretrizes de Segurança do Zello

**Pontifícia Universidade Católica do Paraná — Bacharelado em Sistemas de Informação**
**Trabalho de Conclusão de Curso — Critério de Livre Escolha: OWASP ASVS v5.0.0**

**Autores:** André Alija Ramos Agostini, Rafael Tagliaferro Galafassi, Laura da Costa dos Santos
**Orientadores:** Profa. Marina de Lara, Prof. Vinícius Godoy, Profa. Rafaela Otemaier, Profa. Cristina Verçosa P. B. de Souza, Prof. Evandro Alberto Zatti, Prof. Geucimar Briatore, Profa. Joselaine Valaski
**Versão:** 2.0 — 14/11/2026 (substitui a versão 1.0, que usava a numeração de capítulos do ASVS 4.x)
**Repositórios:** `zello-tcc-back` e `ZELLO-TCC-Front`, branch `security/asvs-v5-l1`

---

## 1. Objetivo e escopo

O OWASP ASVS v5.0.0 exige que certas decisões de segurança sejam documentadas antes de serem verificadas (requisitos `x.1.y`). Este documento registra essas decisões para o Zello e serve de referência para a Matriz de Conformidade (`MATRIZ_CONFORMIDADE_ASVS_V5_L1.md`).

Escopo coberto:

- Os 70 requisitos do Level 1 oficial do ASVS v5.0.0.
- Os 60 critérios aplicáveis da Seção 3 da proposta do TCC, inclusive os que o ASVS classifica como Level 2 ou 3.
- A revisão dos 16 critérios declarados "Não Aplicável" na proposta.

Fora do escopo, por decisão da equipe: testes de intrusão, testes dinâmicos contra ambientes em execução e o "Relatório do Plano de Testes e Evidências de Auditoria" (item 2 da Seção 5 da proposta).

### 1.1 Decisões que alteram a proposta original

| Tema | Proposta | Decisão adotada | Motivo |
|---|---|---|---|
| Composição de senha | Exigir maiúsculas, minúsculas, números e símbolos | Mínimo de 8 caracteres, sem regras de composição, com bloqueio das 3.000 senhas mais comuns | O ASVS v5.0.0 6.2.5 proíbe regras de composição, e o 6.2.4 exige lista de senhas comuns. A regra antiga também empurrava usuários para padrões previsíveis (ex.: `Senha@2026`). |
| OAuth (10.4.3, 10.4.4, 10.4.5, 10.6.1) | Aplicáveis | Não Aplicável | São requisitos do servidor de autorização. O Zello é cliente OAuth e o servidor é o Google. O lado cliente (10.1.2) foi implementado com `state` aleatório e PKCE. |
| Reautenticação (7.5.1) | Não Aplicável | Aplicável e implementado | Trocar o e-mail permitia sequestrar a conta sem conhecer a senha. |
| Política de chaves (11.1.1) | Não Aplicável | Aplicável e documentado (seção 9) | Variáveis de ambiente não substituem a política; o requisito pede o ciclo de vida das chaves. |
| Validade do link de redefinição | 1 hora | 10 minutos | O ASVS 6.5.5 limita códigos fora de banda a 10 minutos. |
| UUID como controle de IDOR (8.1.2) | UUID v4 | UUID v4 **e** verificação de posse/estabelecimento | Identificadores imprevisíveis não impedem acesso indevido quando o ID vaza (URLs, e-mails, logs). |

---

## 2. Arquitetura e fronteiras de confiança

```
Navegador
   │ HTTPS
   ▼
Ingress Azure ──► nginx (frontend estático + proxy /api)
                     │ HTTPS
                     ▼
                 API NestJS ──TLS──────► PostgreSQL / PostGIS
                     ├──────HTTPS──────► Azure Blob Storage (uploads)
                     ├──────HTTPS──────► Google OAuth 2.0
                     └──────SMTP/TLS───► provedor de e-mail
```

- **Fronteira 1 (navegador → nginx):** nada vindo do cliente é confiável. O nginx aplica cabeçalhos de segurança, limita métodos e corpo, só serve extensões permitidas e encaminha `/api` para a API.
- **Fronteira 2 (nginx → API):** a API é a única camada confiável para validação, autenticação e autorização.
- **Mesmo site:** frontend e API respondem pelo mesmo domínio (proxy `/api`). Isso permite cookies `SameSite=Strict` com prefixo `__Host-` e dispensa CORS no navegador.
- **Tenant:** o estabelecimento (`Business`). Um gestor só atua sobre estabelecimentos aos quais está vinculado em `business_manager`.

---

## 3. V2 — Regras de validação de entrada (ASVS 2.1.1)

Toda entrada é validada no backend (`ValidationPipe` global com `whitelist`, `forbidNonWhitelisted`, `forbidUnknownValues` e `transform`). Campos não declarados no DTO fazem a requisição falhar com 400. A validação do frontend existe só para usabilidade.

### 3.1 Regras por tipo de dado

| Dado | Regra | Onde |
|---|---|---|
| Identificadores | UUID (qualquer versão aceita na entrada; entidades usam v4) | `ParseUUIDPipe`, `@IsUUID` |
| E-mail | Formato RFC (`@IsEmail`), até 254 caracteres; comparação sem diferenciar maiúsculas | `CreateUserDto`, `LoginDto`, `UpdateUserDto` |
| Nome | Texto, até 120 caracteres | `CreateUserDto.nome` |
| CPF | 11 dígitos com dígitos verificadores válidos | `@IsCpf` |
| CNPJ | 14 dígitos com dígitos verificadores válidos | `@IsCnpj` |
| Telefone (usuário e estabelecimento) | `^\d{10,11}$` (DDD + número, sem máscara) | `@Matches` |
| CEP | `^\d{8}$` | `@Matches` |
| UF | 2 caracteres | `@Length(2, 2)` |
| Endereço (logradouro, bairro, cidade, complemento) | Texto, até 160/120 caracteres | `@MaxLength` |
| Biografia | Até 280 caracteres | `@MaxLength(280)` |
| Nome e descrição de serviço e combo | Até 120 e 1.000 caracteres | `CreateServiceDto`, `CreateComboDto` |
| Preço de serviço e de combo | Número de 0 a 100.000 com no máximo 2 casas; o preço promocional do combo precisa ser menor que a soma dos serviços | DTOs de catálogo e combo |
| Duração e limpeza | Inteiros em minutos: duração de 1 a 720, limpeza de 0 a 240 | `CreateServiceDto` |
| Combo | De 2 a 20 itens; todos os serviços do mesmo estabelecimento | `CreateComboDto`, `CombosService` |
| Datas | `YYYY-MM-DD` | `@Matches(DATE)` |
| Horários | `HH:mm` ou `HH:mm:ss`, 00–23 / 00–59 | `@Matches(TIME)` |
| Dia da semana | Inteiro 0–6 | `@Min(0) @Max(6)` |
| Listas | Tamanho máximo (ex.: 200 serviços por vínculo, 28 turnos) | `@ArrayMaxSize` |
| Senha | Ver seção 5.2 | `@IsAcceptablePassword` |
| Token de redefinição | `^[a-f0-9]{64}$` | `ResetPasswordDto` |
| Corpo da requisição | JSON/form até 100 kB; multipart até 5 MB por arquivo | `main.ts`, `uploadOptions` |

### 3.2 Regras de negócio sequenciais (ASVS 2.3.1)

| Fluxo | Transições permitidas | Controle |
|---|---|---|
| Agendamento (gestor) | `PENDING → CONFIRMED → COMPLETED` | `STATUS_TRANSITIONS` em `AppointmentsService` |
| Cancelamento e no-show | Só a partir de estados ativos, com as janelas de antecedência definidas | `AppointmentsService` |
| Combo multiprofissional | Aprovar, recusar ou cancelar só a partir de `PENDING`; cancelamento justificado a partir de `PENDING` ou `CONFIRMED` | `ComboBookingsService` |
| Reserva concorrente | Lock transacional por profissional e dia (`pg_advisory_xact_lock`) e nova verificação de sobreposição dentro da transação | Agendamentos e combos |

---

## 4. V5 — Política de arquivos (ASVS 5.1.1)

| Parâmetro | Valor |
|---|---|
| Tipos aceitos em imagens (avatar, banner, portfólio, galeria, foto do estabelecimento) | JPEG, PNG, WEBP |
| Tipos aceitos em certificados (qualificações) | JPEG, PNG, WEBP, PDF |
| Tamanho máximo | 5 MB por arquivo, 1 arquivo por requisição (6 MB de corpo no nginx) |
| Validação | Extensão, MIME declarado e assinatura do conteúdo (*magic bytes*) precisam concordar |
| Nome no armazenamento | `<pasta>/<UUID v4>.<extensão detectada>`. O nome enviado pelo cliente nunca é usado. |
| Pastas | Allowlist fixa: `avatars`, `banners`, `portfolios`, `qualifications`, `business-photos`, `business-banners`, `business-gallery`, `client-photos` |
| Armazenamento | Azure Blob Storage (contêiner `fotos`), origem separada da aplicação, sem execução de código |
| Content-Type gravado | O detectado no conteúdo, não o enviado pelo cliente |
| Arquivos compactados | Não aceitos (sem descompactação no sistema) |
| SVG, HTML, documentos Office | Não aceitos |

**Descarte:** o arquivo fica só em memória (`memoryStorage`) até passar por todas as verificações. Se for reprovado, nada é gravado e a requisição retorna 400 com mensagem genérica. Ao substituir ou remover uma imagem, o blob anterior é apagado; a exclusão só atua em blobs do próprio contêiner. No cadastro, a foto só é enviada depois de validadas as credenciais, para que requisições anônimas inválidas não deixem arquivos órfãos.

**Arquivos suspeitos:** o Zello não executa antivírus próprio. Arquivos que não correspondem à assinatura esperada são recusados. Se um arquivo malicioso for identificado depois de publicado, o procedimento é: remover o blob, remover a referência no banco, registrar o incidente e revisar o log de auditoria do usuário responsável pelo envio.

---

## 5. V6 — Autenticação (ASVS 6.1.1)

### 5.1 Antiautomação e força bruta

| Controle | Limite | Escopo |
|---|---|---|
| Limite global | 300 requisições/minuto (`RATE_LIMIT_GLOBAL_PER_MINUTE`) | Por IP real (ver `TRUST_PROXY_HOPS`) |
| Login | 5 tentativas/minuto | Por IP |
| Login por conta | 10 falhas a cada 15 minutos; a janela expira sozinha, sem bloqueio permanente | Por e-mail |
| Renovação de sessão | 30/minuto | Por IP |
| Recuperação de senha | 5/hora | Por IP |
| Redefinição de senha | 10/hora | Por IP |
| Cadastro | 10/hora | Por IP |
| Início do OAuth | 20/minuto | Por IP |

**Resposta adaptativa:** excedido o limite, a API responde 429 e registra o evento `rate_limit_exceeded`. Falhas de login respondem sempre "E-mail ou senha incorretos.", com o mesmo custo de processamento (bcrypt) para conta inexistente, conta Google, conta desativada e senha errada. A recuperação de senha responde da mesma forma exista ou não o e-mail.

**Limitação conhecida:** o contador por conta fica em memória de cada réplica. Com 2 réplicas, o limite efetivo pode chegar a 20 falhas por janela. Para escala maior, o contador deve migrar para um armazenamento compartilhado (Redis).

### 5.2 Política de senhas

| Regra | Valor | Requisito |
|---|---|---|
| Tamanho mínimo | 8 caracteres (code points Unicode); a interface recomenda 15 ou mais | 6.2.1 |
| Tamanho máximo | 72 bytes UTF-8 (limite do bcrypt). Senhas maiores são recusadas, não truncadas. | 6.2.8 |
| Composição | Nenhuma regra. Espaços, acentos e qualquer caractere são aceitos. | 6.2.5 |
| Lista de bloqueio | 3.000 senhas mais comuns com 8+ caracteres (SecLists, `xato-net-10-million-passwords`, licença MIT), comparação sem diferenciar maiúsculas | 6.2.4 |
| Palavras de contexto | `zello`, `zelloapp`, `zello2026`, `pucpr` (ignorando dígitos e símbolos) | boa prática |
| Onde vale | Cadastro, troca de senha e redefinição | 6.2.4 |
| Troca de senha | Exige a senha atual | 6.2.3 |
| Colar e gerenciadores de senha | Permitidos; campos com `autocomplete` adequado | 6.2.7 |
| Armazenamento | bcrypt, custo 10 | 11.4 |

### 5.3 Recuperação de senha

1. O usuário informa o e-mail; a resposta é sempre genérica.
2. Pedidos anteriores do mesmo usuário são invalidados.
3. Um token de 256 bits é gerado por CSPRNG (`crypto.randomBytes`); só o hash SHA-256 é gravado.
4. O link vai por e-mail com o token no fragmento da URL (`/redefinir-senha#token=...`), que não é enviado ao servidor nem aparece no cabeçalho Referer.
5. O token vale **10 minutos** e é apagado na mesma transação em que a senha é trocada (uso único).
6. A troca encerra todas as sessões do usuário.

### 5.4 Contas padrão e administração

Não existe conta administrativa padrão nem senha de fábrica. O primeiro administrador é uma conta comum, já cadastrada, cujo e-mail é informado em `BOOTSTRAP_ADMIN_EMAIL`. Depois disso, só um administrador promove outro (`PATCH /users/:id/promote-to-admin`).

> **Ação recomendada:** o histórico do repositório contém o script antigo `generate-hash.js` com a senha `Zello123!`. Se alguma conta foi criada com essa senha, ela deve ser trocada.

---

## 6. V7 — Sessão (ASVS 7.1.1)

| Parâmetro | Valor padrão | Variável |
|---|---|---|
| Token de acesso | JWT HS256, 15 minutos | `ACCESS_TOKEN_TTL_MINUTES` (1–60) |
| Inatividade | 30 minutos sem renovação encerram a sessão | `SESSION_IDLE_TIMEOUT_MINUTES` |
| Vida máxima da sessão | 7 dias, mesmo com uso contínuo | `SESSION_ABSOLUTE_TIMEOUT_HOURS` |
| Refresh token | JWT de audiência própria, trocado a cada uso (rotação) | — |
| Reuso de refresh token | Tratado como roubo: todas as sessões do usuário são encerradas | — |
| Transporte | Cookies `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, prefixo `__Host-` em produção | `COOKIE_SAMESITE` |
| Validação | Assinatura, algoritmo, `exp`/`nbf`, emissor, audiência, tipo do token, sessão ativa no banco e conta ativa, em toda requisição | — |

**Ciclo de vida:**

- **Login:** apaga as sessões anteriores do usuário e cria uma nova (7.2.4).
- **Uso:** o frontend renova o token de acesso de forma transparente quando recebe 401, com uma única renovação para requisições simultâneas.
- **Logout:** apaga a sessão no banco, limpa os cookies e envia `Clear-Site-Data`; o frontend limpa o `localStorage` (7.4.1, 14.3.1).
- **Troca de senha:** encerra as demais sessões e mantém a atual; redefinição por e-mail encerra todas (7.4.3).
- **Desativação ou exclusão da conta:** encerra todas as sessões; `isActive=false` impede novos logins (7.4.2).
- **Encerramento administrativo:** `DELETE /users/:id/sessions` (somente admin) (7.4.5).
- **Reautenticação:** trocar e-mail ou senha exige a senha atual (7.5.1).

---

## 7. V8 — Autorização e isolamento multitenant (ASVS 8.1.1 e 8.1.2)

### 7.1 Papéis

| Papel | Quem é |
|---|---|
| `client` | Consumidor que agenda serviços e avalia atendimentos |
| `professional` | Prestador; gerencia o próprio perfil, portfólio, certificados e bloqueios de agenda |
| `manager` | Gestor de um ou mais estabelecimentos (tenant) |
| `admin` | Administrador da plataforma |

Um usuário pode ter mais de um papel. A posse de um papel não basta: toda operação sobre um recurso confere também a relação do usuário com aquele recurso.

### 7.2 Matriz de permissões

| Recurso | Anônimo | client | professional | manager | admin |
|---|---|---|---|---|---|
| Busca, perfis públicos, catálogo, combos, avaliações públicas | Ler | Ler | Ler | Ler | Ler |
| Própria conta (`/users/:id`, `/auth/me`) | — | Ler/alterar a própria | Ler/alterar a própria | Ler/alterar a própria | Qualquer conta |
| Listar usuários, clientes e gestores | — | — | — | — | Sim |
| Promover a admin, desativar conta, encerrar sessões | — | — | — | — | Sim |
| Agendamento: criar, cancelar, remarcar | — | Os próprios | — | — | — |
| Agendamento: confirmar, concluir, no-show, propor remarcação | — | — | — | Só do próprio estabelecimento | — |
| Listar agendamentos | — | Os próprios (`/appointments/me`) | Da própria agenda | Do próprio estabelecimento | — |
| Reputação de cliente | — | A própria | Sim | Sim | Sim |
| Catálogo e combos: criar, alterar, excluir | — | — | — | Só do próprio estabelecimento | — |
| Vínculos de profissionais, serviços habilitados e turnos | — | — | Turnos do próprio vínculo | Só do próprio estabelecimento | Sim |
| Equipe com contatos (`/business-professionals/business/:id/team`) | — | — | — | Só do próprio estabelecimento | Sim |
| Vínculos de gestores | — | — | — | Só do próprio estabelecimento | Sim |
| Horário de funcionamento | — | — | — | Só do próprio estabelecimento | Sim |
| Bloqueios de agenda | — | — | Só da própria agenda | Do próprio estabelecimento e da sua equipe | Sim |
| Dashboard financeiro e operacional | — | — | — | Só do próprio estabelecimento | — |
| Avaliações recebidas do estabelecimento | — | — | — | Só do próprio estabelecimento | Sim |
| Responder avaliação | — | — | As recebidas | As do próprio estabelecimento | — |
| Perfil, portfólio e certificados do profissional | — | — | Só o próprio | — | Excluir |

### 7.3 Regras de acesso por campo (ASVS 8.1.2)

| Campo | Leitura | Escrita |
|---|---|---|
| `passwordHash`, tokens, `hashedToken`, `googleId` | Nunca devolvidos | Só pelos fluxos de autenticação |
| CPF | Nunca devolvido | Só no cadastro |
| Telefone pessoal | Nunca devolvido em respostas | Só no cadastro |
| E-mail de outros usuários | Só o próprio usuário, admin ou rota marcada com `@ExposeContactData` (equipe do gestor) | O próprio, com a senha atual |
| Papéis | O próprio | Só admin (promoção) e fluxo de perfis |
| `isActive` | Não devolvido | Só admin |
| Telefone comercial do estabelecimento | Público | Gestor do estabelecimento |
| `noShowCount`, `successStreak` | Cliente, equipe de atendimento, admin | Só o sistema (eventos de agendamento) e admin |

A remoção é aplicada por um interceptor global (`SensitiveDataInterceptor`), que funciona como última barreira mesmo que um serviço devolva a entidade inteira. A escrita é limitada pelos DTOs (proteção contra mass assignment, 15.3.3).

### 7.4 Regras de implementação

1. `RolesGuard` falha fechado: rota protegida sem `@Roles` é negada.
2. O isolamento por estabelecimento fica em `TenantAccessService` e é aplicado na camada de serviço, nunca no frontend.
3. Recursos derivados (serviço, vínculo, turno, bloqueio, combo, agendamento) são carregados primeiro e o estabelecimento dono é conferido antes de qualquer alteração.
4. Associações entre recursos verificam o tenant (ex.: só serviços do mesmo estabelecimento podem ser habilitados para um profissional).
5. Identificadores são UUID v4, mas nunca são tratados como segredo.

---

## 8. V3, V4, V12 e V13 — Plataforma web

| Controle | API | Frontend (nginx) |
|---|---|---|
| HSTS | 1 ano, `includeSubDomains` | 1 ano, `includeSubDomains` |
| CSP | `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` | `script-src 'self'`; `object-src 'none'`; `base-uri 'none'`; `frame-ancestors 'none'`; origens de imagem e conexão em allowlist |
| `X-Content-Type-Options` | `nosniff` | `nosniff` |
| `Referrer-Policy` | `no-referrer` | `strict-origin-when-cross-origin` |
| Enquadramento | `X-Frame-Options: DENY` | `X-Frame-Options: DENY` |
| Cache | `Cache-Control: no-store` em todas as respostas | `no-cache` no HTML; cache longo só em arquivos com hash |
| CORS | Allowlist exata, sem curinga; em produção só HTTPS | Não necessário (mesmo site) |
| CSRF | `SameSite=Strict` + verificação de `Origin`/`Sec-Fetch-Site` em todo método que altera estado | — |
| Métodos | GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS; demais recebem 405 | Idem |
| Cabeçalhos de proxy | Confia em `TRUST_PROXY_HOPS` saltos fixos | Descarta `X-Real-IP` do cliente e reescreve `X-Forwarded-*` |
| Corpo | 100 kB (JSON/form) | 6 MB |
| Arquivos ocultos e `.git` | Não servidos (imagem sem `.git`) | 404 para qualquer caminho com `/.` |
| Extensões | — | Allowlist: js, css, imagens, fontes, webmanifest, txt; demais 404 |
| Documentação da API | Swagger e Scalar só fora de produção | — |
| TLS | Ingress gerenciado do Azure (TLS 1.2/1.3); TLS validado com o banco | Ingress gerenciado do Azure |

**Exceção documentada na CSP do frontend:** `style-src` permite `'unsafe-inline'` porque o SolidJS, o Tailwind e o Leaflet aplicam estilos inline. Scripts inline continuam proibidos.

---

## 9. V11 — Política de chaves criptográficas (ASVS 11.1.1)

### 9.1 Inventário

| Material | Uso | Algoritmo | Onde fica | Rotação |
|---|---|---|---|---|
| `JWT_SECRET` | Assinar tokens de sessão; derivar a chave HMAC do `state` do OAuth | HMAC-SHA256 (≥ 256 bits) | Segredo do Container App (`secretref:jwt-secret`) | A cada 6 meses ou em suspeita de vazamento |
| Hash de senhas | Armazenar senhas | bcrypt, custo 10 | Banco (`password_hash`) | Não se aplica |
| Token de redefinição | Recuperação de senha | 256 bits aleatórios; SHA-256 no banco | Banco (`password_reset`) | Uso único, 10 minutos |
| `DB_PASS` | Acesso ao PostgreSQL | — | Segredo do Container App | A cada 6 meses |
| `GOOGLE_CLIENT_SECRET` | OAuth com o Google | — | Segredo do Container App | Anual ou em suspeita |
| `AZURE_SAS_TOKEN` | Escrita no Blob Storage | SAS do Azure | Segredo do Container App | Expiração máxima de 1 ano; renovar antes |
| `MAIL_PASS` | SMTP | Senha de app | Segredo do Container App | A cada 6 meses |
| Credenciais de CI/CD | Publicar imagens e implantar | OIDC (sem segredo de longa duração) | GitHub Actions + identidade gerenciada | Não se aplica |

### 9.2 Regras

1. Nenhum segredo fica no código, em `.env` versionado ou em imagem Docker. O `.env` local é ignorado pelo git e pelo Docker.
2. Em produção a aplicação não sobe se `JWT_SECRET` faltar, tiver menos de 32 bytes ou for um valor de exemplo.
3. Geração do segredo JWT: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
4. **Rotação do `JWT_SECRET`:** trocar o segredo no Container App e reiniciar. Todas as sessões são invalidadas e os usuários fazem login de novo. Não há período de convivência entre chaves.
5. **Em caso de vazamento:** rotacionar o segredo afetado imediatamente, revogar SAS e credenciais no provedor, revisar os logs de auditoria do período e registrar o incidente.
6. Algoritmos permitidos: HS256, SHA-256, bcrypt e as cifras do TLS da plataforma. Proibidos: MD5, SHA-1, ECB, `alg: none` e implementações próprias.

---

## 10. V14 — Proteção de dados (ASVS 14.2.4)

| Classe | Exemplos | Exposição na API | Log | Retenção |
|---|---|---|---|---|
| Credenciais | Senha, tokens | Nunca | Nunca (redação automática) | Enquanto a conta existir; tokens até expirar |
| Pessoais sensíveis | CPF, telefone pessoal | Nunca | Nunca | Enquanto a conta existir |
| Pessoais | Nome, e-mail, endereço | Próprio usuário e regras da seção 7.3 | Só o ID do usuário | Exclusão lógica (`deleted_at`) |
| Operacionais | Agendamentos, avaliações, combos | Conforme matriz da seção 7.2 | IDs e status | Exclusão lógica |
| Financeiros agregados | Faturamento, no-shows | Só o gestor do estabelecimento | Não registrados | Calculados sob demanda |

- **Exclusão lógica (soft delete):** usuários, estabelecimentos, profissionais, combos e agendamentos usam `@DeleteDateColumn`. O registro é preservado para auditoria e deixa de aparecer nas consultas.
- **URLs:** dados sensíveis nunca vão na URL. O token de redefinição usa o fragmento `#`, e os logs descartam a query string.
- **Cliente:** o logout envia `Clear-Site-Data` e o frontend limpa os dados de sessão do `localStorage`.

---

## 11. V15 — Dependências e componentes de risco (ASVS 15.1.1)

### 11.1 Prazos de remediação

| Severidade (CVSS / npm audit) | Prazo para atualizar ou mitigar |
|---|---|
| Crítica | 72 horas |
| Alta | 7 dias |
| Média | 30 dias |
| Baixa | 90 dias |
| Atualização sem vulnerabilidade conhecida | Revisão mensal dos PRs do Dependabot |

**Sem correção disponível:** a equipe registra o aceite de risco nesta seção, com o motivo, os controles compensatórios e a data de nova revisão (no máximo 30 dias).

### 11.2 Processo

1. O Dependabot abre PRs semanais (npm) e mensais (GitHub Actions e Docker) para a branch `develop`.
2. O CI roda `npm audit --omit=dev --audit-level=high` em todo push e PR e falha com vulnerabilidade alta ou crítica em produção.
3. Gitleaks, Semgrep, CodeQL e ESLint Security rodam no mesmo pipeline.
4. Dependências sem uso são removidas (nesta revisão: `firebase`, `firebase-admin`, `node-fetch`).
5. `package-lock.json` é versionado e as imagens usam `npm ci`.

### 11.3 Aceites de risco vigentes

| Componente | Situação | Controles compensatórios | Revisão |
|---|---|---|---|
| `whatsapp-web.js` → `puppeteer` → `extract-zip` 2.0.1 (alta) | Não há versão corrigida publicada (2.0.1 é a mais recente). Usado só para baixar o navegador Chromium, que a imagem não baixa (`PUPPETEER_SKIP_DOWNLOAD`). | Integração desligada por padrão (`WHATSAPP_ENABLED=false`); nenhum arquivo do usuário é descompactado; contêiner sem root | 14/12/2026 |
| `@nestjs-modules/mailer` 2.x → `mjml`, `glob` (média) | A correção exige a versão 4 (mudança maior). | Templates de e-mail não usam MJML; nenhuma entrada do usuário chega ao `glob` | 14/12/2026 |
| `typeorm` → `glob` (média) | A correção exige a versão 1.x (mudança maior). | `glob` só é usado na carga de entidades na inicialização | 14/12/2026 |
| `vitest` (média, desenvolvimento) | Executor de testes, não vai para produção | Uso apenas local e no CI | 14/12/2026 |

### 11.4 Funcionalidades perigosas (ASVS 15.2.5)

| Componente | Risco | Proteção |
|---|---|---|
| Cliente WhatsApp (`whatsapp-web.js`) | Executa um navegador Chromium e mantém sessão autenticada no disco | Desligado por padrão; sandbox do Chromium mantido (`--no-sandbox` só com `WHATSAPP_CHROMIUM_NO_SANDBOX=true` em contêiner dedicado); recomenda-se movê-lo para um serviço separado |
| Upload de arquivos | Conteúdo malicioso | Seção 4 |
| Consultas externas (ViaCEP, ReceitaWS) | SSRF | URLs fixas no código; só dígitos validados entram no caminho |
| E-mails HTML | Injeção de HTML | Todo dado do usuário passa por `escapeHtml` |

---

## 12. V16 — Logs e tratamento de erros

**Log de auditoria (todas as requisições):** JSON em uma linha com `timestamp` (UTC, ISO 8601), `requestId`, `method`, `path` (sem query string), `statusCode`, `latencyMs`, `userId`, `ip` e `userAgent`. O `requestId` volta ao cliente no cabeçalho `X-Request-Id`.

**Eventos de segurança:** `login_success`, `login_failure`, `logout`, `token_refresh_failure`, `refresh_token_reuse`, `password_reset_requested`, `password_reset_completed`, `password_reset_failure`, `password_changed`, `sessions_revoked`, `account_status_changed`, `role_granted`, `authorization_denied`, `authentication_required`, `csrf_origin_rejected`, `rate_limit_exceeded`, `oauth_state_rejected` e `unexpected_error`.

**O que nunca é registrado:** senhas, tokens, cookies, cabeçalho `Authorization`, CPF e hashes. A redação é automática por nome de campo.

**Erros:** erros 4xx devolvem a mensagem de negócio. Qualquer erro 5xx ou inesperado devolve "Erro interno. Tente novamente mais tarde." e o `requestId`, sem stack trace, SQL, nomes de tabela ou caminhos de arquivo. O detalhe fica só no log do servidor.

**Retenção:** os logs ficam no Log Analytics do ambiente do Azure Container Apps, com acesso restrito à equipe.

---

## 13. Verificação estática (SAST e SCA)

| Ferramenta | Onde roda | O que verifica |
|---|---|---|
| ESLint + `eslint-plugin-security` | Local e CI | `eval`, `child_process`, regex com risco de ReDoS, `require` dinâmico, PRNG fraco |
| Semgrep (`p/owasp-top-ten`, `p/nodejs`, `p/typescript`) | CI | Padrões OWASP Top 10 |
| GitHub CodeQL (`security-extended`) | CI | Fluxo de dados (injeção, XSS, SSRF) |
| `npm audit` | Local e CI | Vulnerabilidades em dependências |
| Gitleaks | CI | Segredos no código e no histórico |
| Dependabot | GitHub | Atualização de dependências |
| Jest e Vitest | Local e CI | Testes de regressão dos controles (autorização, isolamento, sessão, upload, logs) |

---

## 14. Configuração de implantação

| Variável | Produção | Observação |
|---|---|---|
| `NODE_ENV` | `production` | Ativa cookies `__Host-`, desliga a documentação da API e exige configuração segura |
| `JWT_SECRET` | `secretref:jwt-secret` | ≥ 32 bytes aleatórios |
| `CORS_ALLOWED_ORIGINS` | URL HTTPS do frontend | Sem curinga |
| `FRONTEND_BASE_URL` | URL HTTPS do frontend | Usada nos links de e-mail |
| `GOOGLE_CALLBACK_URL` | `https://<frontend>/api/auth/google/callback` | Atualizar também no Google Cloud Console |
| `TRUST_PROXY_HOPS` | Número de proxies entre o cliente e a API | Ingress do frontend + nginx + ingress da API, conforme a topologia |
| `DB_SSL` / `DB_SYNCHRONIZE` / `DB_MIGRATIONS_RUN` | `true` / `false` / `true` | Schema só por migrations |
| `WHATSAPP_ENABLED` | `false` | Ver seção 11.4 |
| `BOOTSTRAP_ADMIN_EMAIL` | Opcional | Ver seção 5.4 |
| `API_UPSTREAM` (frontend) | URL da API | Destino do proxy `/api` no nginx |
| `VITE_API_URL` (build do frontend) | `/api` | Mesmo site |

**Migration:** `src/migrations/1763140000000-SessionHardening.ts` adiciona as colunas `session_started_at` e `last_used_at` em `refresh_token` e encerra as sessões existentes, porque o formato dos tokens mudou. Ela é idempotente e roda na inicialização em produção (`DB_MIGRATIONS_RUN=true`).

---

## 15. Referências

- OWASP FOUNDATION. *Application Security Verification Standard (ASVS) — Version 5.0.0*. Maio de 2025.
- AGOSTINI, A. A. R.; GALAFASSI, R. T.; SANTOS, L. C. *Proposta de Critério de Livre Escolha: Aplicação e Verificação do OWASP ASVS v5.0.0 Level 1 no Ecossistema Zello*. PUCPR, 2026.
- NIST. *SP 800-63B — Digital Identity Guidelines: Authentication and Lifecycle Management*.
- NIST. *SP 800-57 Part 1 — Recommendation for Key Management*.
- MIESSLER, D. *SecLists* (Passwords/Common-Credentials). Licença MIT.

*Uso de IA (Resolução nº 274/2024 — CONSUN/PUCPR): a revisão de código, a implementação dos controles e a redação deste documento contaram com apoio de IA generativa (Claude, Anthropic). As decisões e os resultados devem ser revisados e validados pela equipe, que é responsável pelo conteúdo final.*
