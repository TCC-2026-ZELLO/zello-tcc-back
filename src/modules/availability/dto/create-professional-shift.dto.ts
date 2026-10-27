import { IsInt, IsString, IsUUID, Min, Max, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProfessionalShiftDto {
  @ApiProperty({
    description:
      'Dia da semana do turno (0 = Domingo, 1 = Segunda-feira, ..., 6 = Sábado)',
    example: 2,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({
    description: 'Horário de início do turno no formato HH:mm:ss',
    example: '09:00:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'Formato deve ser HH:mm:ss',
  })
  startTime: string;

  @ApiProperty({
    description: 'Horário de término do turno no formato HH:mm:ss',
    example: '18:00:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'Formato deve ser HH:mm:ss',
  })
  endTime: string;

  @ApiProperty({
    description: 'UUID do vínculo do profissional com o estabelecimento',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  //@IsUUID()
  @IsString()
  businessProfessionalId: string;
}
