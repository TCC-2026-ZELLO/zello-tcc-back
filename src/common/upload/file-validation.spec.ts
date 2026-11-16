import { BadRequestException } from '@nestjs/common';
import {
  detectFileType,
  MAX_UPLOAD_BYTES,
  uploadOptions,
  validateUploadedFile,
} from './file-validation';

const pad = (bytes: number[], size = 64) =>
  Buffer.concat([Buffer.from(bytes), Buffer.alloc(size)]);

const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
  Buffer.alloc(32),
]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>'.padEnd(64));

const file = (originalname: string, mimetype: string, buffer: Buffer) => ({
  originalname,
  mimetype,
  buffer,
  size: buffer.length,
});

describe('Validação de upload (v5.0.0-5.2.1, 5.2.2)', () => {
  it('identifica o tipo real pela assinatura do conteúdo', () => {
    expect(detectFileType(PNG)?.mime).toBe('image/png');
    expect(detectFileType(JPEG)?.mime).toBe('image/jpeg');
    expect(detectFileType(WEBP)?.mime).toBe('image/webp');
    expect(detectFileType(PDF)?.mime).toBe('application/pdf');
    expect(detectFileType(HTML)).toBeNull();
    expect(detectFileType(Buffer.alloc(2))).toBeNull();
  });

  it('aceita arquivo em que extensão, MIME e conteúdo concordam', () => {
    expect(
      validateUploadedFile(file('a.png', 'image/png', PNG), 'image'),
    ).toEqual({ mime: 'image/png', extension: 'png' });
    expect(
      validateUploadedFile(file('foto.JPEG', 'image/jpeg', JPEG), 'image')
        .extension,
    ).toBe('jpg');
    expect(
      validateUploadedFile(file('cert.pdf', 'application/pdf', PDF), 'document')
        .extension,
    ).toBe('pdf');
  });

  it('recusa conteúdo que não corresponde ao tipo declarado', () => {
    // Texto HTML renomeado para .png com MIME de imagem.
    expect(() =>
      validateUploadedFile(file('a.png', 'image/png', HTML), 'image'),
    ).toThrow(BadRequestException);
    // PNG real declarado como JPEG.
    expect(() =>
      validateUploadedFile(file('a.jpg', 'image/jpeg', PNG), 'image'),
    ).toThrow(BadRequestException);
    // Extensão final não permitida.
    expect(() =>
      validateUploadedFile(file('a.png.php', 'image/png', PNG), 'image'),
    ).toThrow(BadRequestException);
    // PDF só é aceito onde documentos são permitidos.
    expect(() =>
      validateUploadedFile(file('a.pdf', 'application/pdf', PDF), 'image'),
    ).toThrow(BadRequestException);
  });

  it('recusa arquivo ausente, vazio ou acima do limite', () => {
    expect(() => validateUploadedFile(undefined, 'image')).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateUploadedFile(
        file('a.png', 'image/png', Buffer.alloc(0)),
        'image',
      ),
    ).toThrow(BadRequestException);
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_UPLOAD_BYTES)]);
    expect(() =>
      validateUploadedFile(file('a.png', 'image/png', big), 'image'),
    ).toThrow(BadRequestException);
  });

  it('configura o Multer com limite de tamanho, um arquivo e filtro prévio', () => {
    const options = uploadOptions('image');
    expect(options.limits?.fileSize).toBe(MAX_UPLOAD_BYTES);
    expect(options.limits?.files).toBe(1);

    const ok = jest.fn();
    options.fileFilter?.(
      {} as any,
      { originalname: 'a.webp', mimetype: 'image/webp' } as any,
      ok,
    );
    expect(ok).toHaveBeenCalledWith(null, true);

    const rejected = jest.fn();
    options.fileFilter?.(
      {} as any,
      { originalname: 'a.svg', mimetype: 'image/svg+xml' } as any,
      rejected,
    );
    expect(rejected.mock.calls[0][0]).toBeInstanceOf(BadRequestException);
    expect(rejected.mock.calls[0][1]).toBe(false);
  });
});
