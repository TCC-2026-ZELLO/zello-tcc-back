import {
  IsInt,
  IsString,
  IsBoolean,
  IsUUID,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBusinessOperatingHourDto {
  @ApiProperty({
    description: 'UUID do estabelecimento',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  //@IsUUID()
  @IsString()
  businessId: string;

  @ApiProperty({
    description:
      'Dia da semana (0 = Domingo, 1 = Segunda-feira, ..., 6 = Sábado)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    description: 'Horário de abertura (formato HH:mm ou HH:mm:ss)',
    example: '09:00:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/)
  startTime: string;

  @ApiProperty({
    description: 'Horário de fechamento (formato HH:mm ou HH:mm:ss)',
    example: '19:00:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/)
  endTime: string;

  @ApiProperty({
    description: 'Indica se o estabelecimento abre neste dia da semana',
    example: true,
  })
  @IsBoolean()
  isOpen: boolean;
}
