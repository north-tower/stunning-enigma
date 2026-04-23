import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeadsTable1773984000000 implements MigrationInterface {
  name = 'CreateLeadsTable1773984000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      CREATE TABLE "leads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying,
        "email" character varying,
        "source" character varying,
        "raw_message" text,
        "stage" character varying NOT NULL DEFAULT 'inbox',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "confidence_score" integer,
        "priority" character varying,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_leads_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "idx_leads_stage" ON "leads" ("stage")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_leads_priority" ON "leads" ("priority")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "leads"');
  }
}
