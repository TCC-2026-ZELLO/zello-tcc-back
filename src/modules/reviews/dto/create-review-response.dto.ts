import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReviewResponseDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  text: string;
}
