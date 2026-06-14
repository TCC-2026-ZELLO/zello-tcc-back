import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Business } from './entities/business.entity';
import { GalleryImage } from './entities/gallery-image.entity';
import { BusinessManager } from '../business-managers/entities/business-manager.entity';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { Manager } from '../profiles/managers/entities/manager.entity';
import { UsersService } from '../users/users.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessProfileDto } from './dto/update-business.dto';
import { FilesService } from '../files/files.service';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(GalleryImage)
    private readonly galleryRepo: Repository<GalleryImage>,
    @InjectRepository(BusinessManager)
    private readonly bmRepo: Repository<BusinessManager>,
    @InjectRepository(Manager)
    private readonly managerRepo: Repository<Manager>,
    private readonly filesService: FilesService,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  private async validateOwnership(businessId: string, userId: string) {
    const link = await this.bmRepo.findOne({
      where: {
        business: { id: businessId },
        manager: { user: { id: userId } },
      },
    });

    if (!link) {
      throw new ForbiddenException(
        'Você não tem permissão para gerir esta empresa.',
      );
    }
    return link;
  }

  async updateProfile(
    id: string,
    userId: string,
    dto: UpdateBusinessProfileDto,
  ) {
    await this.validateOwnership(id, userId);
    const business = await this.findOne(id);

    if (dto.tradeName !== undefined) business.tradeName = dto.tradeName;
    if (dto.description !== undefined) business.description = dto.description;
    if (dto.visibilityStatus !== undefined)
      business.visibilityStatus = dto.visibilityStatus;
    if (dto.timezone !== undefined) business.timezone = dto.timezone;

    if (business.tradeName && business.description && business.photoUrl) {
      business.profileComplete = true;
    }

    return await this.businessRepo.save(business);
  }

  async updatePhoto(id: string, userId: string, url: string) {
    await this.validateOwnership(id, userId);
    const business = await this.findOne(id);

    if (business.photoUrl) this.filesService.deleteFile(business.photoUrl);

    business.photoUrl = url;
    return await this.businessRepo.save(business);
  }

  async updateBanner(id: string, userId: string, url: string) {
    await this.validateOwnership(id, userId);
    const business = await this.findOne(id);

    if (business.bannerUrl) this.filesService.deleteFile(business.bannerUrl);

    business.bannerUrl = url;
    return await this.businessRepo.save(business);
  }

  async addGalleryImage(id: string, userId: string, url: string) {
    await this.validateOwnership(id, userId);
    const business = await this.findOne(id);

    const newImage = this.galleryRepo.create({ url, business });
    return await this.galleryRepo.save(newImage);
  }

  async removeGalleryImage(id: string, userId: string, imageId: string) {
    await this.validateOwnership(id, userId);

    const image = await this.galleryRepo.findOne({
      where: { id: imageId, business: { id } },
    });

    if (!image)
      throw new NotFoundException(
        'Imagem não encontrada na galeria desta empresa.',
      );

    this.filesService.deleteFile(image.url);
    return await this.galleryRepo.remove(image);
  }

  async findGallery(businessId: string) {
    return await this.galleryRepo.find({
      where: { business: { id: businessId } },
      select: ['id', 'url'],
    });
  }

  async findOne(id: string): Promise<Business> {
    const business = await this.businessRepo.findOne({
      where: { id },
      relations: ['galleryImages'],
    });
    if (!business) throw new NotFoundException('Empresa não encontrada.');
    return business;
  }

  async findMyBusinesses(userId: string) {
    return await this.bmRepo.find({
      where: { manager: { user: { id: userId } } },
      relations: ['business'],
    });
  }

  async create(
    dto: CreateBusinessDto,
    requester: ActiveUser,
  ): Promise<Business> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = await this.usersService.appendManager(
        requester.id,
        queryRunner.manager,
      );
      const business = queryRunner.manager.create(Business, {
        tradeName: dto.tradeName,
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      });
      const savedBusiness = await queryRunner.manager.save(Business, business);

      const link = queryRunner.manager.create(BusinessManager, {
        manager: { id: manager.id },
        business: { id: savedBusiness.id },
      });
      await queryRunner.manager.save(BusinessManager, link);

      await queryRunner.commitTransaction();
      return savedBusiness;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Erro ao criar empresa.');
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Business[]> {
    return await this.businessRepo.find();
  }

  async remove(id: string): Promise<{ message: string }> {
    const business = await this.findOne(id);
    await this.businessRepo.softRemove(business);
    return { message: 'Empresa removida com sucesso.' };
  }
}
