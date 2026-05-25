import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import {
  User,
} from '../src/modules/users/entities/user.entity';
import * as bcrypt from 'bcrypt';

describe('Autenticação (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Setup inicial com timeout estendido para o Docker
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Ativa os pipes de validação para os testes de DTO e Regex funcionarem
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    // SEED: Garante que o utilizador de teste existe na base de dados
    const userRepo = dataSource.getRepository(Usuario);
    const emailTeste = 'rafael@exemplo.com';
    const existingUser = await userRepo.findOne({
      where: { email: emailTeste },
    });

    if (!existingUser) {
      const passwordHash = await bcrypt.hash('SenhaForte@2026', 10);
      await userRepo.save(
        userRepo.create({
          nome: 'Rafael Teste',
          email: emailTeste,
          passwordHash,
          provider: AuthProvider.LOCAL,
        }),
      );
    }
  }, 30000);

  // Encerramento seguro das conexões
  afterAll(async () => {
    if (app) await app.close();
  });

  // --- Fluxo de Login ---
  describe('Fluxo de Login', () => {
    it('POST /auth/login - deve realizar login e retornar tokens (snake_case)', async () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'rafael@exemplo.com',
          password: 'SenhaForte@2026',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body).toHaveProperty('refresh_token');
        });
    });

    it('POST /auth/login - deve rejeitar login com senha errada no banco (401)', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'rafael@exemplo.com',
          password: 'SenhaIncorreta@123', // Passa no DTO, mas falha no Auth
        })
        .expect(401);
    });
  });

  // --- Proteção de Rotas ---
  describe('Proteção de Rotas (Autorização)', () => {
    it('GET /users/perfil - deve bloquear acesso sem token', () => {
      return request(app.getHttpServer()).get('/users/perfil').expect(401);
    });

    it('GET /users/perfil - deve permitir acesso com JWT válido', async () => {
      // 1. Obtém o token real
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'rafael@exemplo.com', password: 'SenhaForte@2026' });

      const token = loginRes.body.access_token;

      // 2. Tenta aceder à rota protegida
      return request(app.getHttpServer())
        .get('/users/perfil')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          // CORREÇÃO: Estrutura alinhada com o UsersController
          expect(res.body.usuarioLogado.email).toBe('rafael@exemplo.com');
          expect(res.body.message).toBe('Acesso autorizado!');
        });
    });
  });

  // --- Recuperação de Senha ---
  describe('Fluxo de Recuperação de Senha', () => {
    it('POST /auth/forgot-password - deve responder 200 para segurança de enumeração', () => {
      return request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nao-existe@zello.com' })
        .expect(200);
    });

    it('POST /auth/reset-password - deve barrar senha fraca via DTO (400)', () => {
      return request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: 'token-valido',
          newPassword: '123',
        })
        .expect(400);
    });

    it('POST /auth/reset-password - deve rejeitar token inexistente (401)', () => {
      return request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: 'token-fantasma',
          newPassword: 'SenhaForte@2026',
        })
        .expect(401);
    });
  });
});
