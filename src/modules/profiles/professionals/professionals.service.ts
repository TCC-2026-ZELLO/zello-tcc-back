import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateProfessionalProfileDto } from './dto/update-professional-profile.dto';
import { Professional } from './entities/professional.entity';
import { User } from '../../users/entities/user.entity';
import { PortfolioImage } from './entities/portfolio-image.entity';
import { BusinessProfessionalService } from '../../business-professionals/entities/business-professional-service.entity';
import { FilesService } from '../../files/files.service';

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,
    @InjectRepository(PortfolioImage)
    private readonly portfolioRepo: Repository<PortfolioImage>,
    @InjectRepository(BusinessProfessionalService)
    private readonly bpsRepo: Repository<BusinessProfessionalService>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly filesService: FilesService,
  ) {}

  async findPublicProfile(id: string) {
    const pro = await this.professionalRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!pro) throw new NotFoundException('Profissional não encontrado');
    return pro;
  }

  async findProfessionalServices(professionalId: string) {
    return await this.bpsRepo.find({
      where: { businessProfessional: { professional: { id: professionalId } } },
      relations: [
        'service',
        'businessProfessional',
        'businessProfessional.business',
      ],
    });
  }

  async findPortfolio(professionalId: string) {
    return await this.portfolioRepo.find({
      where: { professional: { id: professionalId } },
      select: ['id', 'url'],
    });
  }

  async findAll() {
    return await this.professionalRepo.find({
      relations: ['user'],
      order: { user: { name: 'ASC' } },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfessionalProfileDto) {
    const professional = await this.professionalRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!professional) throw new NotFoundException('Perfil não encontrado');

    if (dto.bio !== undefined) professional.biography = dto.bio;
    if (dto.visibilityStatus !== undefined)
      professional.visibilityStatus = dto.visibilityStatus;
    if (dto.specialty !== undefined) professional.specialty = dto.specialty;

    if (professional.biography && professional.specialty) {
      professional.profileComplete = true;
    }

    return await this.professionalRepo.save(professional);
  }

  async updateAvatar(userId: string, imageUrl: string) {
    const professional = await this.professionalRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!professional) throw new NotFoundException('Perfil não encontrado');

    if (professional.photoUrl)
      this.filesService.deleteFile(professional.photoUrl);

    professional.photoUrl = imageUrl;
    return await this.professionalRepo.save(professional);
  }

  async updateBanner(userId: string, imageUrl: string) {
    const professional = await this.professionalRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!professional) throw new NotFoundException('Perfil não encontrado');

    if (professional.bannerUrl)
      this.filesService.deleteFile(professional.bannerUrl);

    professional.bannerUrl = imageUrl;
    return await this.professionalRepo.save(professional);
  }

  async addPortfolioImage(userId: string, url: string) {
    const professional = await this.professionalRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!professional) throw new NotFoundException('Perfil não encontrado');

    const newImage = this.portfolioRepo.create({ url, professional });
    return await this.portfolioRepo.save(newImage);
  }

  async removePortfolioImage(userId: string, imageId: string) {
    const professional = await this.professionalRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!professional) throw new NotFoundException('Perfil não encontrado');

    const image = await this.portfolioRepo.findOne({
      where: { id: imageId, professional: { id: professional.id } },
    });
    if (!image) throw new NotFoundException('Imagem não encontrada');

    this.filesService.deleteFile(image.url);
    return await this.portfolioRepo.remove(image);
  }

  async remove(id: string) {
    const professional = await this.professionalRepo.findOne({ where: { id } });
    if (!professional)
      throw new NotFoundException('Profissional não encontrado');

    return await this.professionalRepo.softRemove(professional);
  }

  async revalidateVisibility(professionalId: string) {
    const professional = await this.professionalRepo.findOne({
      where: { id: professionalId },
      relations: ['businessProfessionals'],
    });

    if (!professional) return;

    const servicesCount = await this.bpsRepo.count({
      where: { businessProfessional: { professional: { id: professionalId } } },
    });

    if (servicesCount === 0) {
      professional.visibilityStatus = false;
      await this.professionalRepo.save(professional);
    }
  }
}
