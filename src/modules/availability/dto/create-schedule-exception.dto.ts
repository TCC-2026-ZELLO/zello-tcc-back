import { IsString, IsOptional, IsUUID, Matches } from 'class-validator';

export class CreateScheduleExceptionDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data deve ser YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString({ each: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    each: true,
    message: 'Datas devem ser YYYY-MM-DD',
  })
  dates?: string[];

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
  endTime?: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  businessId?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  skipConflicts?: boolean;

  @IsOptional()
  forceOverwritePending?: boolean;
}
