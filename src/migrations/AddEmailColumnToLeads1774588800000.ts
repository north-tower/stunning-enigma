import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailColumnToLeads1774588800000 implements MigrationInterface {
  name = 'AddEmailColumnToLeads1774588800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "leads" ADD COLUMN "email_subject" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "leads" ADD COLUMN "email_body" text',
    );
    await queryRunner.query(
      'ALTER TABLE "leads" ADD COLUMN "email_sent" boolean NOT NULL DEFAULT false',
    );
    await queryRunner.query(
      'ALTER TABLE "leads" ADD COLUMN "email_sent_at" TIMESTAMPTZ',
    );
    await queryRunner.query(
      'ALTER TABLE "leads" ADD COLUMN "review_queued" boolean NOT NULL DEFAULT false',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "leads" DROP COLUMN "review_queued"');
    await queryRunner.query('ALTER TABLE "leads" DROP COLUMN "email_sent_at"');
    await queryRunner.query('ALTER TABLE "leads" DROP COLUMN "email_sent"');
    await queryRunner.query('ALTER TABLE "leads" DROP COLUMN "email_body"');
    await queryRunner.query('ALTER TABLE "leads" DROP COLUMN "email_subject"');
  }
}
