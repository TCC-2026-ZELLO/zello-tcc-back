import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import {
  UPLOAD_FOLDERS,
  UploadFolder,
  UploadKind,
  validateUploadedFile,
} from '../../common/upload/file-validation';

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

  /**
   * Valida e grava um arquivo enviado pelo usuário.
   *
   * - v5.0.0-5.2.1 / 5.2.2: tamanho, extensão, MIME declarado e assinatura do
   *   conteúdo (magic bytes) são conferidos antes de qualquer gravação.
   * - v5.0.0-5.3.2: o nome do blob é gerado internamente (UUID v4 + extensão
   *   derivada do conteúdo real). O nome enviado pelo cliente nunca compõe o
   *   caminho, o que elimina path traversal e sobrescrita de arquivos.
   * - v5.0.0-5.3.1: o destino é um armazenamento de objetos, sem execução de
   *   código, e o Content-Type gravado é o detectado, não o declarado.
   */
  async uploadPublicFile(
    file: MulterFile,
    folder: string,
    kind: UploadKind = 'image',
  ): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Arquivo de imagem inválido ou ausente.');
    }
    if (!(UPLOAD_FOLDERS as readonly string[]).includes(folder)) {
      throw new BadRequestException('Destino de upload inválido.');
    }

    const detected = validateUploadedFile(file, kind);

    try {
      const fileName = `${folder as UploadFolder}/${randomUUID()}.${detected.extension}`;
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);

      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: detected.mime,
          blobCacheControl: 'public, max-age=31536000, immutable',
        },
      });

      this.logger.log(`Arquivo salvo no Azure: ${fileName}`);

      const safe_url = new URL(blockBlobClient.url);
      safe_url.search = '';

      return safe_url.toString();
    } catch (err: any) {
      this.logger.error(`Erro no Azure Blob Storage: ${err.message}`);
      throw new InternalServerErrorException(
        'Falha ao processar o arquivo. Tente novamente mais tarde.',
      );
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Só apaga blobs do próprio contêiner da aplicação: a URL precisa ter o
      // mesmo host do armazenamento configurado e nenhuma travessia de caminho.
      const containerUrl = new URL(this.containerClient.url);
      const target = new URL(fileUrl);
      if (target.host !== containerUrl.host) return;

      const urlParts = target.pathname.split(`/${this.containerName}/`);
      if (urlParts.length < 2) return;

      const blobName = decodeURIComponent(urlParts[1]);
      if (blobName.includes('..') || blobName.startsWith('/')) return;

      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.deleteIfExists();
      this.logger.log(`Arquivo removido do Azure: ${blobName}`);
    } catch {
      this.logger.warn('Erro ao deletar arquivo no Azure.');
    }
  }
}
