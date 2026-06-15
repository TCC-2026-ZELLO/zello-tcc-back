import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateBusinessManagerDto {
  @IsNotEmpty()
  //@IsUUID()
  @IsString()
  managerId: string;

  @IsNotEmpty()
  //@IsUUID()
  @IsString()
  businessId: string;
}
