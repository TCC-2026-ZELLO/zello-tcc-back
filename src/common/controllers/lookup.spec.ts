import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LookupController } from './lookup.controller';
import { ViaCepService } from '../services/viacep.service';
import { CnpjLookupService } from '../services/cnpj-lookup.service';

describe('Lookup Services and Controller', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('ViaCepService', () => {
    let service: ViaCepService;

    beforeEach(() => {
      service = new ViaCepService();
    });

    it('should return null when CEP length is not 8 digits', async () => {
      expect(await service.fetchAddress('123')).toBeNull();
    });

    it('should return null when fetch response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });
      expect(await service.fetchAddress('01001-000')).toBeNull();
    });

    it('should return null when ViaCEP returns erro: true', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ erro: true }),
      });
      expect(await service.fetchAddress('01001000')).toBeNull();
    });

    it('should return formatted address when ViaCEP succeeds', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          logradouro: 'Praça da Sé',
          bairro: 'Sé',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
      });

      const res = await service.fetchAddress('01001-000');
      expect(res).toEqual({
        logradouro: 'Praça da Sé',
        bairro: 'Sé',
        localidade: 'São Paulo',
        uf: 'SP',
      });
    });

    it('should return null when fetch throws network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      expect(await service.fetchAddress('01001000')).toBeNull();
    });
  });

  describe('CnpjLookupService', () => {
    let configService: ConfigService;
    let service: CnpjLookupService;

    beforeEach(() => {
      configService = {
        get: jest.fn().mockReturnValue('true'),
      } as any;
      service = new CnpjLookupService(configService);
    });

    it('should return null when CNPJ_LOOKUP_ENABLED is not true', async () => {
      (configService.get as jest.Mock).mockReturnValue('false');
      expect(await service.fetchCnpjData('11222333000181')).toBeNull();
    });

    it('should return null when CNPJ length is not 14 digits', async () => {
      expect(await service.fetchCnpjData('12345')).toBeNull();
    });

    it('should return null when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false });
      expect(await service.fetchCnpjData('11.222.333/0001-81')).toBeNull();
    });

    it('should return null when ReceitaWS returns status ERROR', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ERROR' }),
      });
      expect(await service.fetchCnpjData('11222333000181')).toBeNull();
    });

    it('should return formatted company data on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK',
          nome: 'Empresa LTDA',
          fantasia: 'Zello',
          logradouro: 'Rua A',
          numero: '100',
          complemento: 'Sala 1',
          bairro: 'Centro',
          municipio: 'Curitiba',
          uf: 'PR',
          cep: '80.000-000',
        }),
      });

      const result = await service.fetchCnpjData('11.222.333/0001-81');
      expect(result).toEqual({
        nome: 'Empresa LTDA',
        fantasia: 'Zello',
        logradouro: 'Rua A',
        numero: '100',
        complemento: 'Sala 1',
        bairro: 'Centro',
        municipio: 'Curitiba',
        uf: 'PR',
        cep: '80000000',
      });
    });

    it('should return null when fetch throws error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Timeout'));
      expect(await service.fetchCnpjData('11222333000181')).toBeNull();
    });
  });

  describe('LookupController', () => {
    let viaCepService: ViaCepService;
    let cnpjLookupService: CnpjLookupService;
    let controller: LookupController;

    beforeEach(() => {
      viaCepService = { fetchAddress: jest.fn() } as any;
      cnpjLookupService = { fetchCnpjData: jest.fn() } as any;
      controller = new LookupController(viaCepService, cnpjLookupService);
    });

    it('should return address when lookupCep succeeds', async () => {
      (viaCepService.fetchAddress as jest.Mock).mockResolvedValue({
        logradouro: 'Rua X',
      });
      expect(await controller.lookupCep('80000000')).toEqual({
        logradouro: 'Rua X',
      });
    });

    it('should throw NotFoundException when lookupCep returns null', async () => {
      (viaCepService.fetchAddress as jest.Mock).mockResolvedValue(null);
      await expect(controller.lookupCep('00000000')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return CNPJ data when lookupCnpj succeeds', async () => {
      (cnpjLookupService.fetchCnpjData as jest.Mock).mockResolvedValue({
        nome: 'Zello',
      });
      expect(await controller.lookupCnpj('11222333000181')).toEqual({
        nome: 'Zello',
      });
    });

    it('should throw NotFoundException when lookupCnpj returns null', async () => {
      (cnpjLookupService.fetchCnpjData as jest.Mock).mockResolvedValue(null);
      await expect(controller.lookupCnpj('11222333000181')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
