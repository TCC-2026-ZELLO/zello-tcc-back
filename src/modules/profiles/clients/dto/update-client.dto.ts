import { IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  noShowCount?: number;

  @ApiProperty({ example: 3, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  successStreak?: number;
}
