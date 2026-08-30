import { IsEnum, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ReviewTargetType } from '../entities/review.entity';

export class CreateReviewDto {
  @IsString()
  appointmentId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  comment: string;

  @IsEnum(ReviewTargetType)
  targetType: ReviewTargetType;
}
