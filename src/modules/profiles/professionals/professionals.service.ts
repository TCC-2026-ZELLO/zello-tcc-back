import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { UpdateProfessionalProfileDto } from './dto/update-professional-profile.dto';
import { Professional } from './entities/professional.entity';
import { Role } from '../../users/entities/role.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(Professional)
    private professionalRepo: Repository<Professional>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async create(dto: CreateProfessionalDto) {
    const exists = await this.professionalRepo.findOne({
      where: { user: { id: dto.userId } },
    });

    if (exists) {
      throw new ConflictException(
        'Este usuário já possui um perfil de profissional.',
      );
    }

    const user = await this.userRepo.findOne({
      where: { id: dto.userId },
      relations: ['roles'],
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    const newProfessional = this.professionalRepo.create({
      user: { id: dto.userId },
      biography: dto.bio,
      visibilityStatus: dto.visibilityStatus ?? false,
    });

    const proRole = await this.roleRepo.findOne({
      where: { name: 'professional' },
    });

    if (proRole && !user.roles.some((role) => role.name === 'professional')) {
      user.roles.push(proRole);
      await this.userRepo.save(user);
    }

    return await this.professionalRepo.save(newProfessional);
  }

  async updateProfile(userId: string, dto: UpdateProfessionalProfileDto) {
    const professional = await this.professionalRepo.findOne({
      where: { user: { id: userId } },
    });

    if (!professional) {
      throw new NotFoundException(
        'Perfil de professional não encontrado para este usuário.',
      );
    }

    if (dto.bio !== undefined) {
      professional.biography = dto.bio;
    }

    if (dto.visibilityStatus !== undefined) {
      professional.visibilityStatus = dto.visibilityStatus;
    }

    if (professional.biography && professional.biography.trim().length > 0) {
      professional.profileComplete = true;
    }

    return await this.professionalRepo.save(professional);
  }

  async findAll() {
    return await this.professionalRepo.find({
      relations: ['user'],
      order: {
        user: {
          name: 'ASC',
        },
      },
    });
  }

  async findOne(id: string) {
    const professional = await this.professionalRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!professional) {
      throw new NotFoundException(`Professional with ID "${id}" not found`);
    }

    return professional;
  }

  async update(id: string, updateProfessionalDto: UpdateProfessionalDto) {
    const professional = await this.professionalRepo.findOne({ where: { id } });

    if (!professional) {
      throw new NotFoundException(`Professional with ID "${id}" not found`);
    }

    const updatedProfessional = this.professionalRepo.merge(
      professional,
      updateProfessionalDto,
    );

    return await this.professionalRepo.save(updatedProfessional);
  }

  remove(id: string) {
    return `This action removes a #${id} professional`;
  }
}
