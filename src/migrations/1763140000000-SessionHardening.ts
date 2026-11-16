import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Colunas que sustentam o controle de sessão no backend (v5.0.0-7.2.1, 7.3.1,
 * 7.3.2): início da sessão e último uso do refresh token.
 *
 * As instruções são idempotentes (IF NOT EXISTS), de modo que a migration pode
 * rodar em bancos criados anteriormente por `synchronize`.
 * As sessões existentes são encerradas porque o formato dos tokens mudou
 * (novos claims `sid`, `typ`, `iss` e `aud`); os usuários fazem login de novo.
 */
export class SessionHardening1763140000000 implements MigrationInterface {
  name = 'SessionHardening1763140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('refresh_token');
    if (!hasTable) return;

    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD COLUMN IF NOT EXISTS "session_started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`DELETE FROM "refresh_token"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('refresh_token');
    if (!hasTable) return;

    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP COLUMN IF EXISTS "last_used_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP COLUMN IF EXISTS "session_started_at"`,
    );
  }
}
