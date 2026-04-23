import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'leads' })
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  name?: string | null;

  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', nullable: true })
  source?: 'typeform' | 'gmail' | 'linkedin' | 'manual' | null;

  @Column({ type: 'text', nullable: true, name: 'raw_message' })
  rawMessage?: string | null;

  @Index('idx_leads_stage')
  @Column({ type: 'varchar', default: 'inbox' })
  stage: 'inbox' | 'qualifying' | 'proposal' | 'closed' | 'dead';

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  @Column({ type: 'integer', nullable: true, name: 'confidence_score' })
  confidenceScore?: number | null;

  @Index('idx_leads_priority')
  @Column({ type: 'varchar', nullable: true })
  priority?: 'P0' | 'P1' | 'P2' | 'P3' | null;

  @Column({ type: 'varchar', nullable: true, name: 'email_subject' })
  emailSubject?: string | null;

  @Column({ type: 'text', nullable: true, name: 'email_body' })
  emailBody?: string | null;

  @Column({ type: 'boolean', default: false, name: 'email_sent' })
  emailSent: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'email_sent_at' })
  emailSentAt?: Date | null;

  @Column({ type: 'boolean', default: false, name: 'review_queued' })
  reviewQueued: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
