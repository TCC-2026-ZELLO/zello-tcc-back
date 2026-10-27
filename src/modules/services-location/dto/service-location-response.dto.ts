import { ApiProperty } from '@nestjs/swagger';

export class ServiceLocationResponseDto {
  @ApiProperty({
    description: 'UUID do estabelecimento encontrado',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  id: string;

  @ApiProperty({
    description: 'Nome fantasia do estabelecimento',
    example: 'Studio Belle Époque Curitiba',
  })
  name: string;

  @ApiProperty({
    description: 'Latitude geográfica do estabelecimento (WGS84)',
    example: -25.4284,
  })
  latitude: number;

  @ApiProperty({
    description: 'Longitude geográfica do estabelecimento (WGS84)',
    example: -49.2733,
  })
  longitude: number;

  @ApiProperty({
    description: 'Nota média de avaliações do estabelecimento (0 a 5)',
    example: 4.8,
  })
  rating: number;

  @ApiProperty({
    description: 'Categoria principal do estabelecimento',
    example: 'Salão de Beleza e Estética',
  })
  category: string;

  @ApiProperty({
    description: 'Resumo dos serviços ativos oferecidos no local',
    example: 'Corte Feminino, Mechas Criativas, Hidratação Profunda, Manicure',
  })
  services: string;

  @ApiProperty({
    example: 1.8,
    description: 'Distância calculada até o cliente, em quilômetros.',
  })
  distanceKm: number;
}
