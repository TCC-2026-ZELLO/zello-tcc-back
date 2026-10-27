import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class GetUserDto extends PickType(CreateUserDto, ['email', 'nome']) {}
