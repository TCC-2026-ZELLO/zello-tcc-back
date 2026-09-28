import { IsInt, IsString, IsUUID, Min, Max, Matches } from 'class-validator';

export class CreateProfessionalShiftDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'Formato deve ser HH:mm:ss',
  })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'Formato deve ser HH:mm:ss',
  })
  endTime: string;

  //@IsUUID()
  @IsString()
  businessProfessionalId: string;
}
