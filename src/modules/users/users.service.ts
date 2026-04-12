import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Papel } from './entities/role.entity';
import * as bcrypt from 'bcrypt';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuario)
    private usuariosRepository: Repository<Usuario>,

    @InjectRepository(Papel)
    private papeisRepository: Repository<Papel>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const saltRounds = 10;
    const hash = await bcrypt.hash(createUserDto.password, saltRounds);

    const novoUsuario = this.usuariosRepository.create({
      nome: createUserDto.nome,
      email: createUserDto.email,
      passwordHash: hash,
    });

    const usuarioSalvo = await this.usuariosRepository.save(novoUsuario);

    const { passwordHash, ...userSemSenha } = usuarioSalvo;
    return userSemSenha;
  }

  async createViaGoogle(nome: string, email: string, googleId: string) {
    const usuarioExistente = await this.usuariosRepository.findOne({
      where: { email },
      relations: ['papeis'],
    });

    if (usuarioExistente) {
      if (!usuarioExistente.googleId) {
        usuarioExistente.googleId = googleId;
        await this.usuariosRepository.save(usuarioExistente);
      }
      return usuarioExistente;
    }

    const papelPadrao = await this.papeisRepository.findOne({
      where: { nome: 'gestor' },
    });

    const novoUsuarioGoogle = this.usuariosRepository.create({
      nome,
      email,
      googleId,
      papeis: papelPadrao ? [papelPadrao] : [],
    });

    return await this.usuariosRepository.save(novoUsuarioGoogle);
  }

  async updateGoogleId(id: string, googleId: string) {
    return await this.usuariosRepository.update(id, { googleId });
  }

  async findOne(id: string) {
    const usuario = await this.usuariosRepository.findOne({
      where: { id },
      relations: ['papeis'],
    });

    if (!usuario) {
      throw new NotFoundException(
        'Usuário não encontrado em nossa base de dados.',
      );
    }

    return usuario;
  }

  async findAll() {
    return await this.usuariosRepository.find({
      relations: ['papeis'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const usuario = await this.findOne(id);

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
      usuario.passwordHash = updateUserDto.password;
    }

    if (updateUserDto.nome) usuario.nome = updateUserDto.nome;
    if (updateUserDto.email) usuario.email = updateUserDto.email;

    const usuarioAtualizado = await this.usuariosRepository.save(usuario);

    const { passwordHash, ...userSemSenhaAtualizado } = usuarioAtualizado;

    return userSemSenhaAtualizado;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.usuariosRepository.softDelete(id);

    return { message: 'Usuário excluído com sucesso.' };
  }

  async findByEmailWithPassword(email: string): Promise<Usuario | null> {
    return this.usuariosRepository.findOne({
      where: { email },
      relations: ['papeis'],
      select: ['id', 'nome', 'email', 'passwordHash', 'provider'],
    });
  }
}
