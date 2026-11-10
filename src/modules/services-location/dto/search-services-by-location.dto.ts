import { IsNumber, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchServicesByLocationDto {
  @ApiProperty({
    description: 'Latitude do cliente (WGS84).',
    example: -25.4284,
    minimum: -90,
    maximum: 90,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'A latitude deve ser um número válido.' })
  @Min(-90, { message: 'A latitude deve ser maior ou igual a -90.' })
  @Max(90, { message: 'A latitude deve ser menor ou igual a 90.' })
  latitude: number;

  @ApiProperty({
    description: 'Longitude do cliente (WGS84).',
    example: -49.2733,
    minimum: -180,
    maximum: 180,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'A longitude deve ser um número válido.' })
  @Min(-180, { message: 'A longitude deve ser maior ou igual a -180.' })
  @Max(180, { message: 'A longitude deve ser menor ou igual a 180.' })
  longitude: number;
}
