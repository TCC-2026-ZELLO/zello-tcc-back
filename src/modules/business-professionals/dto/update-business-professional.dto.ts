import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateBusinessProfessionalDto } from './create-business-professional-dto';

export class UpdateBusinessProfessionalDto extends PartialType(
  CreateBusinessProfessionalDto,
) {}

export class UpdateProfessionalServicesDto {
  @ApiProperty({
    description: 'Lista de UUIDs dos serviços habilitados para este profissional',
    example: [
      '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    ],
    type: [String],
  })
  serviceIds: string[];
}

export class ProfessionalShiftItemDto {
  @ApiProperty({
    description: 'Dia da semana (0 = Domingo ... 6 = Sábado)',
    example: 1,
  })
  dayOfWeek: number;

  @ApiProperty({
    description: 'Horário inicial do turno (HH:mm:ss)',
    example: '09:00:00',
  })
  startTime: string;

  @ApiProperty({
    description: 'Horário final do turno (HH:mm:ss)',
    example: '18:00:00',
  })
  endTime: string;
}

export class UpdateProfessionalShiftsDto {
  @ApiProperty({
    description: 'Lista completa de turnos semanais do profissional',
    type: [ProfessionalShiftItemDto],
    example: [
      { dayOfWeek: 1, startTime: '09:00:00', endTime: '18:00:00' },
      { dayOfWeek: 2, startTime: '09:00:00', endTime: '18:00:00' },
      { dayOfWeek: 3, startTime: '13:00:00', endTime: '20:00:00' },
    ],
  })
  shifts: ProfessionalShiftItemDto[];
}
