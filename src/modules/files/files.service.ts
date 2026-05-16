import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface MulterFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly uploadPath = path.resolve(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
      this.logger.log('📂 Diretório de uploads inicializado no disco.');
    }
  }

  uploadPublicFile(file: MulterFile, folder: string): string {
    if (!file || !file.buffer) {
      throw new BadRequestException('Arquivo de imagem inválido ou ausente.');
    }

    try {
      const folderPath = path.join(this.uploadPath, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const safeName = file.originalname
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9.\-_]/g, '');

      const fileName = `${uuidv4()}-${safeName}`;
      const fullPath = path.join(folderPath, fileName);

      fs.writeFileSync(fullPath, file.buffer);

      this.logger.log(`✅ Arquivo salvo: ${folder}/${fileName}`);

      return `http://localhost:3001/uploads/${folder}/${fileName}`;
    } catch (err: any) {
      this.logger.error(`❌ Erro no FileSystem: ${err.message}`);
      throw new InternalServerErrorException(
        'Falha ao gravar arquivo no disco.',
      );
    }
  }

  deleteFile(fileUrl: string): void {
    try {
      const relativePath = fileUrl.split('/uploads/')[1];
      if (!relativePath) return;

      const fullPath = path.join(this.uploadPath, relativePath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        this.logger.log(`🗑️ Arquivo removido do disco: ${relativePath}`);
      }
    } catch (err: any) {
      this.logger.warn(`⚠️ Erro ao deletar arquivo físico: ${fileUrl}`);
    }
  }
}
