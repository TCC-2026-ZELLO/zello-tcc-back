import { Injectable } from '@nestjs/common';

export interface ViaCepResponse {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

@Injectable()
export class ViaCepService {
  async fetchAddress(cep: string): Promise<ViaCepResponse | null> {
    const cleanCep = cep.replace(/[^\d]+/g, '');
    if (cleanCep.length !== 8) return null;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) return null;

      const data = await response.json();
      if (data.erro) return null;

      return {
        logradouro: data.logradouro,
        bairro: data.bairro,
        localidade: data.localidade,
        uf: data.uf,
      };
    } catch (error) {
      return null;
    }
  }
}
