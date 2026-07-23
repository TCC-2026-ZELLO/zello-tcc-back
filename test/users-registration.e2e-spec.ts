import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UsersRegistration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const generateEmail = (prefix: string) => `${prefix}${Date.now()}@test.com`;

  const generateCpf = () => {
    const randomDigit = () => Math.floor(Math.random() * 10);
    const d = Array.from({ length: 9 }, randomDigit);
    let d1 = 11 - (d.reduce((sum, val, i) => sum + val * (10 - i), 0) % 11);
    if (d1 >= 10) d1 = 0;
    let d2 = 11 - ([...d, d1].reduce((sum, val, i) => sum + val * (11 - i), 0) % 11);
    if (d2 >= 10) d2 = 0;
    return [...d, d1, d2].join('');
  };

  const generateCnpj = () => {
    const randomDigit = () => Math.floor(Math.random() * 10);
    const d = Array.from({ length: 8 }, randomDigit);
    const base = [...d, 0, 0, 0, 1];
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let d1 = 11 - (base.reduce((sum, val, i) => sum + val * weights1[i], 0) % 11);
    if (d1 >= 10) d1 = 0;
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let d2 = 11 - ([...base, d1].reduce((sum, val, i) => sum + val * weights2[i], 0) % 11);
    if (d2 >= 10) d2 = 0;
    return [...base, d1, d2].join('');
  };

  describe('Cadastro de Cliente', () => {
    it('deve criar um cliente com CPF e telefone', async () => {
      const email = generateEmail('client');
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          nome: 'Cliente Teste',
          email,
          password: 'Password123!',
          termosAceitos: true,
          accountType: 'CLIENTE',
          phone: '11988887777',
          cpf: generateCpf(),
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe(email);
      expect(response.body.data.roles.map((r: any) => r.name)).toContain('client');
    });

    it('deve rejeitar cliente com CPF inválido', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          nome: 'Cliente Falha',
          email: generateEmail('fail'),
          password: 'Password123!',
          termosAceitos: true,
          accountType: 'CLIENTE',
          phone: '11988887777',
          cpf: '00000000000',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('CPF inválido.');
    });
  });

  describe('Cadastro de Profissional', () => {
    it('deve criar profissional com especialidade', async () => {
      const email = generateEmail('prof');
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          nome: 'Profissional Teste',
          email,
          password: 'Password123!',
          termosAceitos: true,
          accountType: 'PROFISSIONAL',
          phone: '11988887777',
          cpf: generateCpf(),
          specialty: 'Cabeleireiro',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.roles.map((r: any) => r.name)).toContain('professional');
    });
  });

  describe('Cadastro de Estabelecimento', () => {
    it('deve criar estabelecimento com CNPJ e endereço', async () => {
      const email = generateEmail('estab');
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          nome: 'Gerente Teste',
          email,
          password: 'Password123!',
          termosAceitos: true,
          accountType: 'ESTABELECIMENTO',
          phone: '11988887777',
          cnpj: generateCnpj(),
          legalName: 'Empresa Teste LTDA',
          zipCode: '01001000',
          street: 'Rua Direita',
          addressNumber: '123',
          neighborhood: 'Sé',
          city: 'São Paulo',
          state: 'SP',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.roles.map((r: any) => r.name)).toContain('manager');
    });

    it('deve rejeitar estabelecimento sem CNPJ', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          nome: 'Gerente Falha',
          email: generateEmail('fail2'),
          password: 'Password123!',
          termosAceitos: true,
          accountType: 'ESTABELECIMENTO',
          phone: '11988887777',
          legalName: 'Empresa Falha',
          // missing cnpj and address
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('O CNPJ é obrigatório.');
    });
  });
});
