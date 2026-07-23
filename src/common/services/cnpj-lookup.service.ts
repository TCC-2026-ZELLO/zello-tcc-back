import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CnpjLookupResponse {
  nome: string;
  fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
}

@Injectable()
export class CnpjLookupService {
  constructor(private readonly configService: ConfigService) {}
  
  async fetchCnpjData(cnpj: string): Promise<CnpjLookupResponse | null> {
    if (this.configService.get<string>('CNPJ_LOOKUP_ENABLED') !== 'true') {
      return null;
    }

    const cleanCnpj = cnpj.replace(/[^\d]+/g, '');
    if (cleanCnpj.length !== 14) return null;

    try {
      const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`);
      if (!response.ok) return null;

      const data = await response.json();
      if (data.status === 'ERROR') return null;

      return {
        nome: data.nome,
        fantasia: data.fantasia,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        municipio: data.municipio,
        uf: data.uf,
        cep: data.cep.replace(/[^\d]+/g, ''),
      };
    } catch (error) {
      return null;
    }
  }
}
