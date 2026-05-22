import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

export interface MulterFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private containerClient: ContainerClient;
  private readonly containerName = 'fotos';

  constructor() {
    const sasUrl = process.env.AZURE_SAS_URL;
    const sasToken = process.env.AZURE_SAS_TOKEN;

    if (!sasUrl || !sasToken) {
      this.logger.error(
        'Azure Storage configs (AZURE_SAS_URL or AZURE_SAS_TOKEN) are missing in .env',
      );
    }

    const token = sasToken?.startsWith('?') ? sasToken : `?${sasToken}`;
    const fullUrl = `${sasUrl}${token}`;

    const blobServiceClient = new BlobServiceClient(fullUrl);
    this.containerClient = blobServiceClient.getContainerClient(
      this.containerName,
    );

    this.containerClient.createIfNotExists({ access: 'blob' }).catch((err) => {
      this.logger.warn(
        `Could not verify/create Azure container automatically: ${err.message}`,
      );
    });
  }

  async uploadPublicFile(file: MulterFile, folder: string): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Arquivo de imagem inválido ou ausente.');
    }

    try {
      const safeName = file.originalname
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9.\-_]/g, '');

      const fileName = `${folder}/${uuidv4()}-${safeName}`;
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);

      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
      });

      this.logger.log(`✅ Arquivo salvo no Azure: ${fileName}`);

      return blockBlobClient.url;
    } catch (err: any) {
      this.logger.error(`❌ Erro no Azure Blob Storage: ${err.message}`);
      throw new InternalServerErrorException(
        `Falha ao gravar arquivo na nuvem. Detalhes do Azure: ${err.message}`,
      );
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const urlParts = fileUrl.split(`/${this.containerName}/`);
      if (urlParts.length < 2) return;

      const blobName = decodeURIComponent(urlParts[1]);
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.deleteIfExists();
      this.logger.log(`Arquivo removido do Azure: ${blobName}`);
    } catch {
      this.logger.warn(`Erro ao deletar arquivo no Azure: ${fileUrl}`);
    }
  }
}
