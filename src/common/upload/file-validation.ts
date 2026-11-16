import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { extname } from 'path';

/**
 * Política de upload do Zello (v5.0.0-5.1.1, 5.2.1, 5.2.2, 5.3.1, 5.3.2).
 * Documentada em docs/security/ESPECIFICACAO_DIRETRIZES_SEGURANCA_ZELLO.md, seção V5.
 */
export type UploadKind = 'image' | 'document';

export interface DetectedFileType {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  extension: 'jpg' | 'png' | 'webp' | 'pdf';
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED: Record<
  UploadKind,
  { mimes: string[]; extensions: string[]; label: string }
> = {
  image: {
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    label: 'JPEG, PNG ou WEBP',
  },
  document: {
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
    label: 'JPEG, PNG, WEBP ou PDF',
  },
};

/** Pastas de destino aceitas; qualquer outra é recusada (v5.0.0-5.3.2). */
export const UPLOAD_FOLDERS = [
  'avatars',
  'banners',
  'portfolios',
  'qualifications',
  'business-photos',
  'business-banners',
  'business-gallery',
  'client-photos',
] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/** Identifica o tipo real do arquivo pela assinatura (magic bytes) do conteúdo. */
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && // RIFF
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8) // WEBP
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    // %PDF-
    return { mime: 'application/pdf', extension: 'pdf' };
  }
  return null;
}

const EQUIVALENT_EXTENSIONS: Record<string, string[]> = {
  jpg: ['.jpg', '.jpeg'],
  png: ['.png'],
  webp: ['.webp'],
  pdf: ['.pdf'],
};

/**
 * Validação completa de um arquivo recebido: tamanho, extensão declarada,
 * MIME declarado e assinatura do conteúdo, que precisam concordar entre si.
 * O arquivo reprovado é descartado (fica só em memória e nunca é gravado).
 */
export function validateUploadedFile(
  file:
    | {
        originalname?: string;
        mimetype?: string;
        size?: number;
        buffer?: Buffer;
      }
    | undefined
    | null,
  kind: UploadKind,
): DetectedFileType {
  const rules = ALLOWED[kind];
  const reject = () =>
    new BadRequestException(
      `Arquivo inválido. Envie ${rules.label} com até ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
    );

  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new BadRequestException('Arquivo ausente ou vazio.');
  }
  if (file.buffer.length > MAX_UPLOAD_BYTES) throw reject();

  const extension = extname(file.originalname ?? '').toLowerCase();
  if (!rules.extensions.includes(extension)) throw reject();
  if (!rules.mimes.includes((file.mimetype ?? '').toLowerCase()))
    throw reject();

  const detected = detectFileType(file.buffer);
  if (!detected || !rules.mimes.includes(detected.mime)) throw reject();
  if (detected.mime !== file.mimetype?.toLowerCase()) throw reject();
  if (!EQUIVALENT_EXTENSIONS[detected.extension].includes(extension)) {
    throw reject();
  }
  return detected;
}

/**
 * Opções do Multer aplicadas a todo endpoint de upload: memória (nada vai para
 * o disco do servidor), um arquivo por requisição, limite de tamanho e filtro
 * prévio de extensão e MIME. A assinatura do conteúdo é conferida depois, em
 * FilesService.uploadPublicFile, quando o buffer já está disponível.
 */
export function uploadOptions(kind: UploadKind): MulterOptions {
  const rules = ALLOWED[kind];
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
      fields: 40,
      fieldSize: 64 * 1024,
      parts: 45,
    },
    fileFilter: (_req, file, callback) => {
      const extension = extname(file.originalname ?? '').toLowerCase();
      const ok =
        rules.mimes.includes((file.mimetype ?? '').toLowerCase()) &&
        rules.extensions.includes(extension);
      if (ok) return callback(null, true);
      callback(
        new BadRequestException(
          `Formato de arquivo não suportado. Envie ${rules.label}.`,
        ),
        false,
      );
    },
  };
}
