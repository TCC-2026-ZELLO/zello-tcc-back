import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateBusinessManagerDto {
  @IsNotEmpty()
  @IsUUID()
  managerId: string;

  @IsNotEmpty()
  @IsUUID()
  businessId: string;
}
