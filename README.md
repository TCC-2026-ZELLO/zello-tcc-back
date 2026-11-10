# Zello API — Backend (TCC PUCPR)

API RESTful do **Zello**, uma plataforma integrada para descoberta, gestão e agendamento inteligente de serviços nos segmentos de estética, beleza e bem-estar.

---

## Sumário

1. [Sobre o Projeto](#1-sobre-o-projeto)
2. [Arquitetura e Tecnologias Utilizadas](#2-arquitetura-e-tecnologias-utilizadas)
3. [Pré-requisitos e Montagem do Ambiente](#3-pré-requisitos-e-montagem-do-ambiente)
4. [Como Executar o Projeto](#4-como-executar-o-projeto)
5. [Como Executar os Testes](#5-como-executar-os-testes)
6. [Documentação Interativa OpenAPI (Swagger & Scalar)](#6-documentação-interativa-openapi-swagger--scalar)
7. [Wiki de Serviços e Endpoints da API](#7-wiki-de-serviços-e-endpoints-da-api)
8. [Exemplos de Payloads com Dados Reais](#8-exemplos-de-payloads-com-dados-reais)

---

## 1. Sobre o Projeto

O **Zello** conecta **Clientes**, **Profissionais (Especialistas)** e **Estabelecimentos (Gestores)** em um único ecossistema digital, solucionando problemas comuns de conflitos de agenda, ociosidade por faltas injustificadas (*No-Show*) e dificuldade de encontrar especialistas qualificados próximos ao cliente.

### Principais Funcionalidades do Backend
- **Autenticação e Segurança (`auth`, `users`)**:
  - Autenticação via JWT armazenado em cookies `HTTP-Only` (`access_token` e `refresh_token` com rotação automática) e suporte a `Bearer Token`.
  - Login social integrado via **Google OAuth 2.0**.
  - Recuperação e redefinição de senha via token enviado por e-mail.
  - Controle de acesso baseado em papéis (**RBAC**): `client`, `professional`, `manager` e `admin`.
  - Validação algorítmica de CPF e CNPJ e proteção de rotas com `Helmet` e `ThrottlerGuard`.
- **Gestão de Estabelecimentos e Equipe (`businesses`, `business-managers`, `business-professionals`)**:
  - Cadastro de estabelecimentos com endereço geocodificado, fuso horário IANA (`timezone`), foto de perfil, capa (banner) e galeria de fotos.
  - Vinculação de múltiplos gestores e profissionais, com definição granular de quais serviços cada profissional realiza e seus respectivos turnos semanais.
  - Revalidação automática de visibilidade pública do estabelecimento.
- **Catálogo de Serviços e Combos Sincronizados (`catalog`, `combos`, `combo-bookings`)**:
  - Cadastro de serviços com duração de atendimento (`durationMinutes`) e tempo de higienização/preparação pós-serviço (`cleanupMinutes`).
  - Criação de pacotes promocionais (**Combos**) compostos por múltiplos serviços sequenciais com cálculo automático de horários em que todos os profissionais necessários estão disponíveis de forma sincronizada.
- **Disponibilidade e Agenda Inteligente (`availability`, `appointments`)**:
  - Configuração de horários de funcionamento da empresa, turnos de profissionais e bloqueios/exceções de agenda (férias, feriados, ausências parciais ou em lote).
  - Ciclo completo de agendamento: solicitação, aprovação, conclusão, cancelamento pelo cliente, cancelamento justificado pelo gestor, remarcação direta e **proposta de novo horário** pelo gestor com aceite/recusa do cliente.
  - **Sistema de Reputação de Clientes**: monitoramento de faltas injustificadas (`noShowCount`) e sequência de comparecimentos (`successStreak`), além de reversão de *No-Show*.
  - **Lembretes Automatizados (Cron Jobs)**: envio automático de lembretes de agendamento por **E-mail (Nodemailer)** e **WhatsApp (`whatsapp-web.js`)**.
- **Perfis, Portfólio e Qualificações (`clients`, `professionals`, `managers`)**:
  - Gestão de portfólio fotográfico de profissionais e upload comprovado de **Qualificações e Certificados** (PDF/Imagens com validação de formato e tamanho).
- **Avaliações e Respostas (`reviews`)**:
  - Avaliação de atendimentos concluídos (1 a 5 estrelas + comentário) direcionada ao profissional ou ao estabelecimento, permitindo resposta oficial do especialista ou gestor.
- **Busca Avançada e Geolocalização PostGIS (`search`, `services`, `lookup`)**:
  - Busca textual e filtrada de profissionais e empresas por especialidade, faixa de preço (`minPrice`/`maxPrice`), nota mínima (`minRating`) e ordenação (`trending`, `price_asc`).
  - Busca espacial via **PostGIS** (`ST_DWithin` / `ST_DistanceSphere`) que localiza estabelecimentos ativos em um raio fixo de **10 km** a partir da latitude/longitude do cliente.
  - Integração com **ViaCEP** (consulta de CEP) e **ReceitaWS** (consulta cadastral de CNPJ).

---

## 2. Arquitetura e Tecnologias Utilizadas

| Camada / Recurso | Tecnologia | Versão |
| :--- | :--- | :--- |
| **Framework Backend** | [NestJS](https://nestjs.com/) (Node.js + Express) | `^11.0.1` |
| **Linguagem** | TypeScript | `^5.7.3` |
| **ORM & Banco de Dados** | TypeORM + PostgreSQL + extensão espacial **PostGIS** | `0.3.28` / PG `15` + PostGIS `3.4` |
| **Autenticação** | Passport (`passport-jwt`, `passport-google-oauth20`), `bcrypt` | `^11.0.2` |
| **Documentação OpenAPI** | `@nestjs/swagger` + `@scalar/nestjs-api-reference` | `^11.3.2` / `^1.1.9` |
| **Upload e Armazenamento** | Multer + Azure Blob Storage (`@azure/storage-blob`) / Local Fallback | `^12.31.0` |
| **Notificações e Agendador** | `@nestjs/schedule` (Cron), Nodemailer, `whatsapp-web.js` | `^6.1.3` / `^8.0.5` |
| **Testes Automatizados** | Jest + Supertest | `^30.0.0` |
| **Containerização** | Docker & Docker Compose | Compose v2 |

### Estrutura de Diretórios
```text
zello-tcc-back/
├── src/
│   ├── common/                  # Controladores utilitários (Lookup CEP/CNPJ), filtros, interceptors e validadores (CPF/CNPJ)
│   ├── modules/
│   │   ├── addresses/           # Entidade e persistência de endereços com coordenadas geográficas
│   │   ├── appointments/        # Agendamentos, propostas de remarcação, No-Show e Cron Jobs de lembretes
│   │   ├── auth/                # Login JWT/Cookies, Google OAuth2, Refresh Token e recuperação de senha
│   │   ├── availability/        # Horários de funcionamento, turnos e exceções de agenda
│   │   ├── business-managers/   # Vínculos de gestores com estabelecimentos
│   │   ├── business-professionals/ # Vínculos de profissionais, serviços habilitados e turnos
│   │   ├── businesses/          # Gestão de estabelecimentos e galeria de imagens
│   │   ├── catalog/             # Catálogo de serviços (preço, duração, tempo de limpeza)
│   │   ├── combos/              # Pacotes promocionais de serviços e reservas sincronizadas
│   │   ├── files/               # Upload de arquivos (Azure Blob Storage / Disco local)
│   │   ├── media/               # Módulo de suporte de mídia
│   │   ├── profiles/            # Perfis de Clientes, Profissionais (portfólio/qualificações) e Gestores
│   │   ├── reviews/             # Avaliações (1 a 5 estrelas) e respostas de profissionais/gestores
│   │   ├── search/              # Busca filtrada e recomendações de profissionais e empresas
│   │   ├── services-location/   # Busca geolocalizada em raio de 10km com PostGIS
│   │   ├── users/               # Gestão de contas de usuários e roles
│   │   └── whatsapp/            # Integração de notificações via WhatsApp
│   ├── app.module.ts            # Módulo raiz da aplicação
│   └── main.ts                  # Bootstrap, configuração de CORS, Pipes, Swagger e Scalar
├── test/                        # Configuração de testes E2E
├── Dockerfile                   # Imagem de produção Node 20 Alpine
├── docker-compose.yml           # Orquestração PostgreSQL/PostGIS + API NestJS
├── .env.example                 # Modelo de variáveis de ambiente
└── package.json                 # Scripts e dependências
```

---

## 3. Pré-requisitos e Montagem do Ambiente

### 3.1. Pré-requisitos instalados na máquina
- **Node.js**: versão `20.x` (LTS) ou superior (`node -v`)
- **npm**: versão `10.x` ou superior (`npm -v`)
- **Docker** e **Docker Compose**: recomendados para subir o banco de dados **PostgreSQL 15 com PostGIS 3.4** sem necessidade de instalação manual da extensão espacial.
- **Git**: para clonagem e versionamento.

### 3.2. Passo a Passo para Montar o Ambiente

1. **Acesse a pasta do backend**:
   ```bash
   cd zello-tcc-back
   ```

2. **Instale as dependências do Node.js**:
   ```bash
   npm install
   ```

3. **Configure o arquivo de variáveis de ambiente (`.env`)**:
   Copie o arquivo modelo `.env.example` para `.env`:
   ```bash
   # Linux / macOS / Git Bash
   cp .env.example .env

   # Windows (PowerShell)
   Copy-Item .env.example .env
   ```

4. **Referência das Variáveis de Ambiente (`.env`)**:

   | Variável | Obrigatória | Exemplo / Padrão | Descrição |
   | :--- | :---: | :--- | :--- |
   | `PORT` | Não | `3001` | Porta HTTP em que o backend irá escutar. |
   | `NODE_ENV` | Não | `development` | Ambiente de execução (`development`, `test`, `production`). |
   | `DB_HOST` | **Sim** | `localhost` (ou `db-tcc` no Docker) | Host do banco PostgreSQL/PostGIS. |
   | `DB_PORT` | **Sim** | `5433` (local) / `5432` (container) | Porta do PostgreSQL (`docker-compose.yml` expõe `5433:5432`). |
   | `DB_USER` | **Sim** | `postgres` | Usuário do banco de dados. |
   | `DB_PASS` | **Sim** | `postgres` | Senha do banco de dados. |
   | `DB_NAME` | **Sim** | `zello_db` | Nome do banco de dados. |
   | `JWT_SECRET` | **Sim** | `chave_secreta_forte_zello_2026` | Segredo para assinatura e validação dos tokens JWT. |
   | `FRONTEND_BASE_URL` | **Sim** | `http://localhost:5173` | URL base do frontend para links de redirecionamento e recuperação de senha. |
   | `CORS_ALLOWED_ORIGINS` | Não | `http://localhost:5173,http://localhost:3000` | Lista de origens permitidas pelo CORS separadas por vírgula. |
   | `GOOGLE_CLIENT_ID` | Não* | `123456-abc.apps.googleusercontent.com` | Client ID do Google Cloud Console (*necessário para Login Google). |
   | `GOOGLE_CLIENT_SECRET` | Não* | `GOCSPX-...` | Client Secret do Google OAuth 2.0. |
   | `GOOGLE_CALLBACK_URL` | Não* | `http://localhost:3001/auth/google/callback` | URL de callback registrada no Google OAuth 2.0. |
   | `GOOGLE_REDIRECT_URL` | Não | `http://localhost:5173/explore` | URL de destino no frontend após login com Google. |
   | `MAIL_HOST` | Não* | `smtp.gmail.com` | Servidor SMTP para envio de e-mails transacionais. |
   | `MAIL_PORT` | Não* | `587` | Porta do servidor SMTP. |
   | `MAIL_USER` | Não* | `notificacoes@zello.com.br` | Usuário de autenticação SMTP. |
   | `MAIL_PASS` | Não* | `senha_de_app` | Senha de autenticação SMTP. |
   | `MAIL_SECURE` | Não | `false` | Define uso de TLS direto (`true` para porta 465, `false` para 587). |
   | `MAIL_FROM` | Não | `"Zello <noreply@zello.com.br>"` | Remetente padrão dos e-mails enviados. |
   | `AZURE_SAS_URL` | Não | `https://conta.blob.core.windows.net` | URL do Azure Blob Storage. Se vazio, salva localmente em `./uploads`. |
   | `AZURE_SAS_TOKEN` | Não | `sv=2022-11-02&ss=b...` | Token SAS de escrita no Azure Blob Storage. |
   | `CNPJ_LOOKUP_ENABLED` | Não | `true` | Habilita (`true`) ou desabilita (`false`) a consulta de CNPJ na ReceitaWS. |

---

## 4. Como Executar o Projeto

Você pode executar o projeto de duas maneiras principais: **100% via Docker Compose** ou **Localmente em Modo de Desenvolvimento (Watch Mode)** utilizando apenas o banco de dados no Docker.

### Opção A: Executar Tudo com Docker Compose (Banco PostGIS + API)
Na pasta `zello-tcc-back`, execute:
```bash
docker compose up -d --build
```
- O container `postgres_container` (`postgis/postgis:15-3.4-alpine`) ficará disponível na porta `5433`.
- O container `nestjs_container` aguardará o *healthcheck* do banco e iniciará na porta `3001`.
- Para acompanhar os logs em tempo real:
  ```bash
  docker compose logs -f api-tcc
  ```

### Opção B: Executar a API Localmente em Desenvolvimento (Recomendado para Dev)
1. **Suba apenas o banco de dados PostGIS via Docker**:
   ```bash
   docker compose up -d db-tcc
   ```
   *(Certifique-se de que no seu `.env` os valores sejam `DB_HOST=localhost` e `DB_PORT=5433`).*

2. **Inicie o servidor NestJS em modo Watch (Hot Reload)**:
   ```bash
   npm run start:dev
   ```

3. **Ou compile e execute em modo Produção**:
   ```bash
   npm run build
   npm run start:prod
   ```

Assim que a aplicação iniciar, ela estará disponível em:
- **URL Base da API**: `http://localhost:3001`

---

## 5. Como Executar os Testes

O projeto conta com uma suíte abrangente de testes unitários com meta de cobertura mínima de 75% configurada no Jest:

```bash
# Executar todos os testes unitários
npm run test

# Executar os testes em modo interativo (watch)
npm run test:watch

# Executar os testes e gerar relatório de cobertura ( pasta ./coverage )
npm run test:cov

# Executar testes End-to-End (E2E)
npm run test:e2e
```

---

## 6. Documentação Interativa OpenAPI (Swagger & Scalar)

Com o backend em execução (`http://localhost:3001`), **todos os serviços do backend estão disponíveis em uma única página interativa**, com sumário (`summary`), descrição detalhada (`description`) e exemplos de payloads reais pré-preenchidos:

| Interface de Documentação | URL de Acesso | Descrição |
| :--- | :--- | :--- |
| **Scalar API Reference (Recomendado)** | **[`http://localhost:3001/docs`](http://localhost:3001/docs)** | Interface moderna em página única com busca rápida, exemplos de requisição em múltiplas linguagens (cURL, JS, Python) e cliente HTTP integrado. |
| **Swagger UI** | **[`http://localhost:3001/api-json`](http://localhost:3001/api-json)** | Interface clássica do OpenAPI 3.0 agrupada por módulos com botão *"Try it out"*. |
| **OpenAPI 3.0 Spec (JSON)** | **[`http://localhost:3001/api-json-json`](http://localhost:3001/api-json-json)** | Especificação OpenAPI bruta em formato JSON (importável no Postman / Insomnia). |

---

## 7. Wiki de Serviços e Endpoints da API

Abaixo está o catálogo completo dos **17 módulos** e **87 endpoints** expostos pelo backend do Zello:

### 7.1. Health (`health`)
| Método | Endpoint | Sumário | Autenticação |
| :---: | :--- | :--- | :---: |
| `GET` | `/` | Verificar disponibilidade da API (Health Check) | Público |

### 7.2. Autenticação (`auth`)
| Método | Endpoint | Sumário | Autenticação |
| :---: | :--- | :--- | :---: |
| `POST` | `/auth/login` | Autenticar usuário com e-mail e senha | Público |
| `POST` | `/auth/logout` | Encerrar sessão do usuário autenticado (Logout) | JWT / Cookie |
| `GET` | `/auth/me` | Obter dados da sessão atual do usuário logado | JWT / Cookie |
| `POST` | `/auth/refresh` | Renovar token de acesso (Refresh Token) | Cookie (`refresh_token`) |
| `GET` | `/auth/google` | Iniciar fluxo de login social com Google OAuth 2.0 | Público |
| `GET` | `/auth/google/callback` | Callback de retorno da autenticação Google OAuth 2.0 | Público |
| `POST` | `/auth/forgot-password` | Solicitar recuperação de senha por e-mail | Público |
| `POST` | `/auth/reset-password` | Redefinir senha utilizando token de recuperação | Público |

### 7.3. Usuários (`users`)
| Método | Endpoint | Sumário | Autenticação / Role |
| :---: | :--- | :--- | :---: |
| `POST` | `/users` | Cadastrar novo usuário (Cliente, Profissional ou Estabelecimento) | Público |
| `GET` | `/users/profile` | Obter perfil do usuário autenticado | JWT |
| `GET` | `/users` | Listar todos os usuários cadastrados | JWT (`manager`) |
| `GET` | `/users/:id` | Buscar usuário por ID | Público |
| `PATCH` | `/users/:id` | Atualizar dados cadastrais do usuário | JWT (Próprio ou `admin`) |
| `DELETE` | `/users/:id` | Remover conta de usuário | JWT (Próprio ou `admin`) |
| `POST` | `/users/:id/append-client` | Vincular perfil de Cliente a um usuário existente | JWT |
| `POST` | `/users/:id/append-professional` | Vincular perfil de Profissional a um usuário existente | JWT |
| `POST` | `/users/:id/append-manager` | Vincular perfil de Gestor (Manager) a um usuário existente | JWT |
| `PATCH` | `/users/:id/promote-to-admin` | Promover usuário a Administrador do sistema | Público / Interno |

### 7.4. Estabelecimentos (`businesses`)
| Método | Endpoint | Sumário | Autenticação / Role |
| :---: | :--- | :--- | :---: |
| `POST` | `/businesses` | Cadastrar um novo estabelecimento | JWT (`manager`, `admin`) |
| `GET` | `/businesses` | Listar todos os estabelecimentos cadastrados | JWT (`admin`) |
| `GET` | `/businesses/me` | Listar estabelecimentos gerenciados pelo usuário logado | JWT (`manager`, `admin`) |
| `GET` | `/businesses/:id` | Consultar detalhes de um estabelecimento por ID | JWT |
| `PATCH` | `/businesses/:id/profile` | Atualizar perfil comercial do estabelecimento | JWT (`manager`, `admin`) |
| `POST` | `/businesses/:id/photo` | Atualizar foto de perfil (logo) do estabelecimento | JWT (`manager`, `admin`) |
| `POST` | `/businesses/:id/banner` | Atualizar imagem de capa (banner) do estabelecimento | JWT (`manager`, `admin`) |
| `GET` | `/businesses/:id/gallery` | Listar fotos da galeria de um estabelecimento | JWT |
| `POST` | `/businesses/:id/gallery` | Adicionar foto à galeria do estabelecimento | JWT (`manager`, `admin`) |
| `DELETE` | `/businesses/:id/gallery/:imageId` | Remover foto da galeria do estabelecimento | JWT (`manager`, `admin`) |
| `DELETE` | `/businesses/:id` | Remover um estabelecimento | JWT (`admin`) |

### 7.5. Administração de Gestores da Empresa (`business-administration`)
| Método | Endpoint | Sumário | Autenticação / Role |
| :---: | :--- | :--- | :---: |
| `POST` | `/business-managers` | Vincular gestor a uma empresa | JWT (`admin`, `manager`) |
| `GET` | `/business-managers` | Listar todos os vínculos de gestão | JWT (`admin`) |
| `GET` | `/business-managers/business/:businessId` | Listar gestores de uma empresa específica | JWT (`admin`, `manager`) |
| `GET` | `/business-managers/:id` | Ver detalhes de um vínculo de gestão | JWT |
| `DELETE` | `/business-managers/:id` | Remover permissão de gestão | JWT (`admin`, `manager`) |

### 7.6. Gestão de Profissionais da Empresa (`business-management`)
| Método | Endpoint | Sumário | Autenticação / Role |
| :---: | :--- | :--- | :---: |
| `POST` | `/business-professionals` | Vincular profissional a uma empresa | JWT (`manager`, `admin`) |
| `GET` | `/business-professionals/business/:businessId` | Listar todos os profissionais de uma empresa | Público |
| `GET` | `/business-professionals/:id` | Ver detalhes de um vínculo específico | Público |
| `PATCH` | `/business-professionals/:id` | Atualizar status do vínculo (ativar/desativar) | JWT (`manager`) |
| `DELETE` | `/business-professionals/:id` | Remover profissional da empresa | JWT (`manager`) |
| `GET` | `/business-professionals/:id/services` | Listar serviços habilitados para este vínculo | Público |
| `PATCH` | `/business-professionals/:id/services` | Sincronizar serviços habilitados do profissional | JWT (`manager`) |
| `GET` | `/business-professionals/:id/shifts` | Listar horários de trabalho (turnos) deste vínculo | Público |
| `PATCH` | `/business-professionals/:id/shifts` | Sincronizar turnos semanais do profissional | JWT (`manager`) |

### 7.7. Catálogo de Serviços (`catalog`)
| Método | Endpoint | Sumário | Autenticação / Role |
| :---: | :--- | :--- | :---: |
| `POST` | `/catalog/business/:businessId` | Cadastrar novo serviço no catálogo de um estabelecimento | JWT (`manager`) |
| `GET` | `/catalog/business/:businessId` | Listar serviços de uma empresa específica | Público |
| `GET` | `/catalog/:id` | Ver detalhes de um serviço específico | Público |
| `PATCH` | `/catalog/:id` | Atualizar um serviço do catálogo | JWT (`manager`) |
| `DELETE` | `/catalog/:id` | Remover um serviço e revalidar visibilidade | JWT (`manager`) |

### 7.8. Pacotes Promocionais / Combos (`combos` & `combo-bookings`)
| Método | Endpoint | Sumário | Autenticação / Role |
| :---: | :--- | :--- | :---: |
| `POST` | `/combos/business/:businessId` | Criar um combo promocional de serviços | JWT (`manager`) |
| `GET` | `/combos/business/:businessId` | Listar combos de uma empresa com valor cheio e promocional | Público |
| `GET` | `/combos/:id` | Detalhar um combo específico | Público |
| `GET` | `/combos/:id/availability` | Horários em que todos os profissionais do combo estão livres de forma sincronizada | Público |
| `PATCH` | `/combos/:id` | Atualizar um combo existente | JWT (`manager`) |
| `DELETE` | `/combos/:id` | Remover um combo | JWT (`manager`) |
| `POST` | `/combo-bookings/combo/:comboId` | Solicitar a reserva de um combo | JWT |
| `GET` | `/combo-bookings/me` | Solicitações de combo do cliente logado | JWT |
| `GET` | `/combo-bookings/business/:businessId` | Fila de solicitações de combo da empresa (Gestor) | JWT |
| `PATCH` | `/combo-bookings/:id/approve` | Aprovar o combo e bloquear a agenda de todos os profissionais | JWT |
| `PATCH` | `/combo-bookings/:id/reject` | Recusar o combo com justificativa (Gestor) | JWT |
| `PATCH` | `/combo-bookings/:id/cancel-justified` | Cancelar um combo confirmado (Gestor) | JWT |
| `PATCH` | `/combo-bookings/:id/cancel` | Cancelar a própria solicitação de combo (Cliente) | JWT |

### 7.9. Disponibilidade e Horários (`availability`)
| Método | Endpoint | Sumário | Autenticação / Role |
| :---: | :--- | :--- | :---: |
| `GET` | `/availability/operating-hours` | Consultar horários de funcionamento semanal do estabelecimento | JWT |
| `POST` | `/availability/operating-hours` | Criar ou atualizar horário de funcionamento do estabelecimento | JWT (`manager`, `admin`) |
| `GET` | `/availability/shifts` | Listar turnos de trabalho por vínculo profissional-empresa | JWT (`manager`, `professional`, `admin`) |
| `POST` | `/availability/shifts` | Cadastrar turno de trabalho de um profissional | JWT (`manager`, `professional`, `admin`) |
| `GET` | `/availability/exceptions` | Listar exceções e bloqueios de agenda cadastrados | JWT (`manager`, `professional`, `admin`) |
| `POST` | `/availability/exceptions` | Registrar exceção ou bloqueio de agenda (folga, feriado ou ausência) | JWT (`manager`, `professional`, `admin`) |
| `DELETE` | `/availability/exceptions/:id` | Remover uma exceção ou bloqueio de agenda | JWT (`manager`, `professional`, `admin`) |
| `GET` | `/availability/bounds` | Calcular horários disponíveis para agendamento de um serviço | JWT |

### 7.10. Agendamentos e Reputação (`appointments`)
| Método | Endpoint | Sumário | Autenticação |
| :---: | :--- | :--- | :---: |
| `GET` | `/appointments/me` | Listar agendamentos do cliente logado | JWT |
| `GET` | `/appointments` | Listar agendamentos com filtros de data, empresa e profissional | JWT |
| `POST` | `/appointments` | Realizar um novo agendamento de serviço | JWT |
| `PATCH` | `/appointments/:id/cancel` | Cancelar agendamento pelo próprio cliente | JWT |
| `PATCH` | `/appointments/:id/reschedule` | Reagendar um atendimento (Cliente) | JWT |
| `POST` | `/appointments/:id/reschedule-proposal` | Propor um novo horário ao cliente (Gestor) | JWT |
| `PATCH` | `/appointments/:id/reschedule-proposal` | Aceitar ou recusar a proposta de novo horário (Cliente) | JWT |
| `GET` | `/appointments/business/:businessId` | Listar todos os agendamentos de um estabelecimento (Gestor) | JWT |
| `PATCH` | `/appointments/:id/status` | Atualizar status de um agendamento para CONFIRMED ou COMPLETED | JWT |
| `PATCH` | `/appointments/:id/no-show` | Registrar falta injustificada (No-Show) de um cliente | JWT |
| `PATCH` | `/appointments/:id/revert-no-show` | Reverter marcação de No-Show | JWT |
| `PATCH` | `/appointments/:id/cancel-justified` | Cancelar agendamento com justificativa formal (Gestor) | JWT |
| `GET` | `/appointments/client/:clientId/reputation` | Consultar histórico de reputação e comparecimento de um cliente | JWT |

### 7.11. Perfis de Profissionais, Clientes e Gestores (`professionals`, `clients`, `managers`)
| Método | Endpoint | Sumário | Autenticação / Role |
| :---: | :--- | :--- | :---: |
| `PATCH` | `/professionals/me/profile` | Atualizar perfil público do profissional autenticado | JWT (`professional`) |
| `POST` | `/professionals/me/avatar` | Atualizar foto de perfil (avatar) do profissional | JWT (`professional`) |
| `POST` | `/professionals/me/banner` | Atualizar imagem de capa (banner) do profissional | JWT (`professional`) |
| `POST` | `/professionals/me/portfolio` | Adicionar foto de trabalho ao portfólio do profissional | JWT (`professional`) |
| `DELETE` | `/professionals/me/portfolio/:id` | Remover foto do portfólio do profissional | JWT (`professional`) |
| `POST` | `/professionals/me/qualifications` | Adicionar qualificação e certificado ao perfil (RF9) | JWT (`professional`, `manager`) |
| `PATCH` | `/professionals/me/qualifications/:id` | Editar qualificação do perfil profissional (RF9) | JWT (`professional`, `manager`) |
| `DELETE` | `/professionals/me/qualifications/:id` | Remover qualificação do perfil profissional (RF9) | JWT (`professional`, `manager`) |
| `GET` | `/professionals/:id` | Consultar perfil público de um profissional por ID | Público |
| `GET` | `/professionals/:id/services` | Listar serviços realizados por um profissional | Público |
| `GET` | `/professionals/:id/portfolio` | Listar fotos do portfólio do profissional | Público |
| `GET` | `/professionals/:id/qualifications` | Listar qualificações e certificados do profissional (RF9 - CA3) | Público |
| `GET` | `/professionals` | Listar todos os profissionais cadastrados | JWT (`admin`) |
| `DELETE` | `/professionals/:id` | Remover perfil de um profissional | JWT (`admin`) |
| `POST/GET/PATCH/DELETE` | `/clients` e `/clients/:id` | Gerenciamento de perfis e indicadores de clientes | JWT |
| `POST/GET/PATCH/DELETE` | `/managers` e `/managers/:id` | Gerenciamento de perfis de gestores | JWT (`manager`, `admin`) |

### 7.12. Avaliações (`reviews`)
| Método | Endpoint | Sumário | Autenticação / Role |
| :---: | :--- | :--- | :---: |
| `POST` | `/reviews` | Publicar avaliação de um atendimento concluído | JWT (`client`) |
| `GET` | `/reviews/professional/:id` | Listar avaliações públicas de um profissional | Público |
| `GET` | `/reviews/business/:id` | Listar avaliações públicas de um estabelecimento | Público |
| `GET` | `/reviews/appointment/:id` | Consultar avaliações vinculadas a um agendamento específico | JWT |
| `GET` | `/reviews/me/sent` | Listar avaliações enviadas pelo cliente logado | JWT (`client`) |
| `GET` | `/reviews/me/received` | Listar avaliações recebidas pelo profissional logado | JWT (`professional`) |
| `GET` | `/reviews/business/:id/received` | Listar avaliações recebidas por um estabelecimento | JWT (`manager`) |
| `POST` | `/reviews/:id/response` | Responder a uma avaliação de cliente | JWT (`professional`, `manager`) |
| `PATCH` | `/reviews/:id/response` | Editar resposta de uma avaliação | JWT (`professional`, `manager`) |
| `DELETE` | `/reviews/:id/response` | Remover resposta de uma avaliação | JWT (`manager`) |

### 7.13. Busca, Geolocalização e Consultas Auxiliares (`search`, `services`, `lookup`)
| Método | Endpoint | Sumário | Autenticação |
| :---: | :--- | :--- | :---: |
| `GET` | `/search/professionals` | Buscar profissionais com filtros de texto, preço, nota e ordenação | Público |
| `GET` | `/search/professionals/recommended` | Listar profissionais recomendados em destaque | Público |
| `GET` | `/search/businesses` | Buscar estabelecimentos com filtros de texto, preço, nota e ordenação | Público |
| `GET` | `/services/location` | Busca estabelecimentos ativos com serviços dentro do raio fixo de 10km (PostGIS) | Público |
| `GET` | `/lookup/cep/:cep` | Consultar endereço por CEP via ViaCEP | Público |
| `GET` | `/lookup/cnpj/:cnpj` | Consultar dados cadastrais de empresa por CNPJ via ReceitaWS | Público |

---

## 8. Exemplos de Payloads com Dados Reais

### 8.1. Cadastro de Estabelecimento (`POST /users`)
```json
{
  "nome": "Carlos Eduardo Mendes",
  "email": "contato@studiobelleepoque.com.br",
  "password": "Zello@2026!",
  "termosAceitos": true,
  "accountType": "ESTABELECIMENTO",
  "phone": "41998765432",
  "cnpj": "11222333000181",
  "legalName": "Studio Belle Epoque Estetica e Beleza LTDA",
  "tradeName": "Studio Belle Époque Curitiba",
  "businessPhone": "4133224455",
  "zipCode": "80020310",
  "street": "Rua XV de Novembro",
  "addressNumber": "1299",
  "complement": "Conjunto 402",
  "neighborhood": "Centro",
  "city": "Curitiba",
  "state": "PR"
}
```

### 8.2. Cadastro de Serviço no Catálogo (`POST /catalog/business/:businessId`)
```json
{
  "name": "Corte Masculino + Barba Terapia",
  "description": "Corte personalizado na tesoura e máquina, seguido de ritual de barba com toalha quente, óleo essencial e massagem facial.",
  "durationMinutes": 60,
  "cleanupMinutes": 15,
  "price": 95.0
}
```

### 8.3. Criação de Combo Promocional (`POST /combos/business/:businessId`)
```json
{
  "name": "Pacote Noivo Premium: Corte + Barba Terapia + Limpeza de Pele",
  "description": "Combo completo de preparação com desconto especial, executado em sequência sincronizada pelos nossos especialistas.",
  "price": 149.9,
  "active": true,
  "items": [
    {
      "serviceId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "sequence": 0
    },
    {
      "serviceId": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      "sequence": 1
    }
  ]
}
```

### 8.4. Solicitação de Agendamento (`POST /appointments`)
```json
{
  "businessId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "professionalId": "3b241101-e2bb-4255-8caf-4136c566a962",
  "serviceId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "date": "2026-11-15",
  "startTime": "14:30"
}
```

### 8.5. Avaliação de Atendimento Concluído (`POST /reviews`)
```json
{
  "appointmentId": "c4a760a8-dbcf-4e14-9f39-6a8f1d2e3b4c",
  "rating": 5,
  "comment": "Atendimento impecável! O corte ficou exatamente como eu pedi, o profissional foi super pontual e o ambiente é muito agradável.",
  "targetType": "PROFESSIONAL"
}
```

### 8.6. Busca por Geolocalização 10km (`GET /services/location?latitude=-25.4284&longitude=-49.2733`)
```json
{
  "status": 200,
  "total": 1,
  "data": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "Studio Belle Époque Curitiba",
      "latitude": -25.4284,
      "longitude": -49.2733,
      "rating": 4.8,
      "category": "Salão de Beleza e Estética",
      "services": "Corte Feminino, Mechas Criativas, Hidratação Profunda, Manicure",
      "distanceKm": 1.8
    }
  ]
}
```
