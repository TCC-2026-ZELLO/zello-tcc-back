import {
  IsInt,
  IsString,
  IsBoolean,
  IsUUID,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class CreateBusinessOperatingHourDto {
  @IsUUID()
  businessId: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/)
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/)
  endTime: string;

  @IsBoolean()
  isOpen: boolean;
}
