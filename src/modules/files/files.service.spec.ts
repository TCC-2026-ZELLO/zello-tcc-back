import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FilesService } from './files.service';

const mockUploadData = jest.fn();
const mockDeleteIfExists = jest.fn();
const mockCreateIfNotExists = jest.fn().mockResolvedValue({});

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn().mockImplementation(() => ({
    getContainerClient: jest.fn().mockReturnValue({
      createIfNotExists: mockCreateIfNotExists,
      getBlockBlobClient: jest.fn().mockReturnValue({
        url: 'https://account.blob.core.windows.net/fotos/avatars/img.jpg?sig=123',
        uploadData: mockUploadData,
        deleteIfExists: mockDeleteIfExists,
      }),
    }),
  })),
}));

jest.mock('uuid', () => ({
  v4: () => 'uuid-1234',
}));

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AZURE_SAS_URL = 'https://account.blob.core.windows.net';
    process.env.AZURE_SAS_TOKEN = 'sv=2022';
    service = new FilesService();
  });

  it('should throw BadRequestException if file or buffer is missing', async () => {
    await expect(
      service.uploadPublicFile(null as any, 'avatars'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should upload public file and strip SAS query params from returned URL', async () => {
    mockUploadData.mockResolvedValue({});
    const url = await service.uploadPublicFile(
      {
        originalname: 'my photo (1).jpg',
        buffer: Buffer.from('abc'),
        mimetype: 'image/jpeg',
        size: 3,
      },
      'avatars',
    );

    expect(url).toBe(
      'https://account.blob.core.windows.net/fotos/avatars/img.jpg',
    );
    expect(mockUploadData).toHaveBeenCalled();
  });

  it('should throw InternalServerErrorException when Azure upload fails', async () => {
    mockUploadData.mockRejectedValue(new Error('Azure error'));
    await expect(
      service.uploadPublicFile(
        {
          originalname: 'photo.jpg',
          buffer: Buffer.from('abc'),
          mimetype: 'image/jpeg',
          size: 3,
        },
        'avatars',
      ),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('should delete file when valid container URL is passed and ignore invalid/errors', async () => {
    mockDeleteIfExists.mockResolvedValue({});
    await service.deleteFile(
      'https://account.blob.core.windows.net/fotos/avatars/img.jpg',
    );
    expect(mockDeleteIfExists).toHaveBeenCalled();

    await service.deleteFile('https://other-domain.com/img.jpg');
    expect(mockDeleteIfExists).toHaveBeenCalledTimes(1);

    mockDeleteIfExists.mockRejectedValue(new Error('Delete error'));
    await expect(
      service.deleteFile(
        'https://account.blob.core.windows.net/fotos/avatars/img.jpg',
      ),
    ).resolves.toBeUndefined();
  });
});
