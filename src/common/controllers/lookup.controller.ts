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
  @ApiOperation({ summary: 'Consultar CEP via ViaCEP' })
  @ApiParam({ name: 'cep', example: '01001000' })
  @ApiResponse({ status: 200, description: 'Dados do endereço retornados com sucesso.' })
  @ApiResponse({ status: 404, description: 'CEP não encontrado ou inválido.' })
  async lookupCep(@Param('cep') cep: string) {
    const result = await this.viaCepService.fetchAddress(cep);
    if (!result) {
      throw new NotFoundException('CEP não encontrado ou inválido.');
    }
    return result;
  }

  @Get('cnpj/:cnpj')
  @ApiOperation({ summary: 'Consultar CNPJ via ReceitaWS (requer feature flag)' })
  @ApiParam({ name: 'cnpj', example: '11222333000181' })
  @ApiResponse({ status: 200, description: 'Dados da empresa retornados com sucesso.' })
  @ApiResponse({ status: 404, description: 'CNPJ não encontrado, inválido, ou consulta desabilitada.' })
  async lookupCnpj(@Param('cnpj') cnpj: string) {
    const result = await this.cnpjLookupService.fetchCnpjData(cnpj);
    if (!result) {
      throw new NotFoundException('CNPJ não encontrado, inválido, ou consulta desabilitada.');
    }
    return result;
  }
}
