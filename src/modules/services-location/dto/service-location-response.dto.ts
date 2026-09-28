import { ApiProperty } from '@nestjs/swagger';

export class ServiceLocationResponseDto {
  @ApiProperty({ example: 'a3f1c2e4-...' })
  id: string;

  @ApiProperty({ example: 'Estética Bella' })
  name: string;

  @ApiProperty({ example: -25.4284 })
  latitude: number;

  @ApiProperty({ example: -49.2733 })
  longitude: number;

  @ApiProperty({ example: 4.8 })
  rating: number;

  @ApiProperty({ example: 'Salão de Beleza' })
  category: string;

  @ApiProperty({ example: 'Cabelo, Manicure, Pedicure' })
  services: string;

  @ApiProperty({ example: 3.2, description: 'Distância até o cliente, em quilômetros.' })
  distanceKm: number;
}
