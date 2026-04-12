import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoggersInterceptor } from 'src/common/interceptors/log-interceptor';
import { SucessInterceptor } from 'src/common/interceptors/success-interceptor';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseInterceptors(LoggersInterceptor)
  @UseInterceptors(SucessInterceptor)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }


  @Get(':id')
  @UseInterceptors(LoggersInterceptor)
  @UseInterceptors(SucessInterceptor)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseInterceptors(LoggersInterceptor)
  @UseInterceptors(SucessInterceptor)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseInterceptors(LoggersInterceptor)
  @UseInterceptors(SucessInterceptor)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
