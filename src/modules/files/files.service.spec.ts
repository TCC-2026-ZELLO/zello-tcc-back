import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FilesService } from './files.service';

const mockUploadData = jest.fn();
const mockDeleteIfExists = jest.fn();
const mockCreateIfNotExists = jest.fn().mockResolvedValue({});
const mockGetBlockBlobClient = jest.fn();

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn().mockImplementation(() => ({
    getContainerClient: jest.fn().mockReturnValue({
      url: 'https://account.blob.core.windows.net/fotos?sv=2022',
      createIfNotExists: mockCreateIfNotExists,
      getBlockBlobClient: mockGetBlockBlobClient,
    }),
  })),
}));

const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(64),
]);
const jpegFile = (originalname = 'photo.jpg') => ({
  originalname,
  buffer: JPEG,
  mimetype: 'image/jpeg',
  size: JPEG.length,
});

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBlockBlobClient.mockImplementation((name: string) => ({
      url: `https://account.blob.core.windows.net/fotos/${name}?sig=123`,
      uploadData: mockUploadData,
      deleteIfExists: mockDeleteIfExists,
    }));
    process.env.AZURE_SAS_URL = 'https://account.blob.core.windows.net';
    process.env.AZURE_SAS_TOKEN = 'sv=2022';
    service = new FilesService();
  });

  it('should throw BadRequestException if file or buffer is missing', async () => {
    await expect(
      service.uploadPublicFile(null as any, 'avatars'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should name the blob with an internal UUID, never the client file name (v5.0.0-5.3.2)', async () => {
    mockUploadData.mockResolvedValue({});
    const url = await service.uploadPublicFile(
      jpegFile('../../etc/passwd my photo (1).jpg'),
      'avatars',
    );

    const blobName = mockGetBlockBlobClient.mock.calls[0][0] as string;
    expect(blobName).toMatch(
      /^avatars\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/,
    );
    expect(blobName).not.toContain('passwd');
    expect(blobName).not.toContain('..');
    // A URL devolvida não carrega o token SAS.
    expect(url).toBe(`https://account.blob.core.windows.net/fotos/${blobName}`);
    // O Content-Type gravado é o detectado no conteúdo.
    expect(mockUploadData.mock.calls[0][1].blobHTTPHeaders.blobContentType).toBe(
      'image/jpeg',
    );
  });

  it('should reject content that does not match the declared type (v5.0.0-5.2.2)', async () => {
    await expect(
      service.uploadPublicFile(
        {
          originalname: 'photo.jpg',
          buffer: Buffer.from('<?php echo 1; ?>'.padEnd(64)),
          mimetype: 'image/jpeg',
          size: 64,
        },
        'avatars',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockUploadData).not.toHaveBeenCalled();
  });

  it('should reject an unknown destination folder', async () => {
    await expect(
      service.uploadPublicFile(jpegFile(), '../outro-container'),
    ).rejects.toThrow(BadRequestException);
    expect(mockUploadData).not.toHaveBeenCalled();
  });

  it('should throw InternalServerErrorException when Azure upload fails', async () => {
    mockUploadData.mockRejectedValue(new Error('Azure error'));
    await expect(
      service.uploadPublicFile(jpegFile(), 'avatars'),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('should delete only blobs of its own container and ignore invalid/errors', async () => {
    mockDeleteIfExists.mockResolvedValue({});
    await service.deleteFile(
      'https://account.blob.core.windows.net/fotos/avatars/img.jpg',
    );
    expect(mockDeleteIfExists).toHaveBeenCalledTimes(1);

    await service.deleteFile('https://other-domain.com/fotos/avatars/img.jpg');
    await service.deleteFile('nao-e-uma-url');
    await service.deleteFile(
      'https://account.blob.core.windows.net/fotos/%2E%2E/outro/img.jpg',
    );
    expect(mockDeleteIfExists).toHaveBeenCalledTimes(1);

    mockDeleteIfExists.mockRejectedValue(new Error('Delete error'));
    await expect(
      service.deleteFile(
        'https://account.blob.core.windows.net/fotos/avatars/img.jpg',
      ),
    ).resolves.toBeUndefined();
  });
});
