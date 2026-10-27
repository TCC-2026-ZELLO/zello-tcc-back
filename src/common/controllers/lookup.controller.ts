import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ViaCepService } from '../services/viacep.service';
import { CnpjLookupService } from '../services/cnpj-lookup.service';

@ApiTags('lookup')
@Controller('lookup')
export class LookupController {
  constructor(
    private readonly viaCepService: ViaCepService,
    private readonly cnpjLookupService: CnpjLookupService,
  ) {}

  @Get('cep/:cep')
  @ApiOperation({
    summary: 'Consultar endereço por CEP via ViaCEP',
    description:
      'Consulta pública que busca logradouro, bairro, cidade e UF na base do ViaCEP a partir de um CEP de 8 dígitos para preenchimento automático de formulários.',
  })
  @ApiParam({
    name: 'cep',
    description: 'CEP brasileiro contendo 8 dígitos numéricos',
    example: '80020310',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados do endereço retornados com sucesso.',
    schema: {
      example: {
        cep: '80020-310',
        logradouro: 'Rua XV de Novembro',
        complemento: 'de 1001/1002 ao fim',
        bairro: 'Centro',
        localidade: 'Curitiba',
        uf: 'PR',
        ibge: '4106902',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'CEP não encontrado ou inválido.' })
  async lookupCep(@Param('cep') cep: string) {
    const result = await this.viaCepService.fetchAddress(cep);
    if (!result) {
      throw new NotFoundException('CEP não encontrado ou inválido.');
    }
    return result;
  }

  @Get('cnpj/:cnpj')
  @ApiOperation({
    summary: 'Consultar dados cadastrais de empresa por CNPJ via ReceitaWS',
    description:
      'Realiza a consulta pública dos dados cadastrais de uma pessoa jurídica (Razão Social, Nome Fantasia, Endereço e Telefone) via ReceitaWS. Requer que a variável CNPJ_LOOKUP_ENABLED esteja habilitada.',
  })
  @ApiParam({
    name: 'cnpj',
    description: 'CNPJ contendo 14 dígitos numéricos',
    example: '11222333000181',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados da empresa retornados com sucesso.',
    schema: {
      example: {
        cnpj: '11.222.333/0001-81',
        nome: 'STUDIO BELLE EPOQUE ESTETICA E BELEZA LTDA',
        fantasia: 'STUDIO BELLE EPOQUE',
        logradouro: 'RUA XV DE NOVEMBRO',
        numero: '1299',
        bairro: 'CENTRO',
        municipio: 'CURITIBA',
        uf: 'PR',
        cep: '80.020-310',
        telefone: '(41) 3322-4455',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'CNPJ não encontrado, inválido, ou consulta desabilitada.',
  })
  async lookupCnpj(@Param('cnpj') cnpj: string) {
    const result = await this.cnpjLookupService.fetchCnpjData(cnpj);
    if (!result) {
      throw new NotFoundException(
        'CNPJ não encontrado, inválido, ou consulta desabilitada.',
      );
    }
    return result;
  }
}
