import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassifierService } from '../classifier/classifier.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { Lead } from './entities/lead.entity';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @Inject(forwardRef(() => ClassifierService))
    private readonly classifierService: ClassifierService,
  ) {}

  async createLead(dto: CreateLeadDto): Promise<Lead> {
    const lead = this.leadRepository.create({
      name: dto.name,
      email: dto.email,
      source: dto.source,
      rawMessage: dto.message,
      metadata: dto.metadata ?? {},
      stage: 'inbox',
    });

    const savedLead = await this.leadRepository.save(lead);

    setImmediate(() => {
      this.classifierService
        .processLead(savedLead.id)
        .catch((error: unknown) => {
          this.logger.error(
            `Background classification failed for ${savedLead.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
    });

    return savedLead;
  }

  normalizePayload(
    raw: any,
    source: string,
  ): {
    name: string | null;
    email: string | null;
    source: 'typeform' | 'gmail' | 'linkedin' | 'manual';
    rawMessage: string | null;
    metadata: Record<string, unknown>;
  } {
    if (source === 'tally' && raw?.data?.fields) {
      const fields = raw.data.fields as Array<{ label?: string; value?: unknown }>;

      const get = (label: string): string | null =>
        (fields.find((f) =>
          (f.label ?? '').toLowerCase().includes(label.toLowerCase()),
        )?.value as string | undefined) ?? null;

      return {
        name: get('full name'),
        email: get('email'),
        source: 'typeform',
        rawMessage: get('looking for') ?? get('message'),
        metadata: {
          company: get('company'),
          howDidYouHear: get('hear about'),
          tallyResponseId: raw.data.responseId ?? null,
        },
      };
    }

    return {
      name: raw?.name ?? null,
      email: raw?.email ?? null,
      source: (raw?.source ?? 'manual') as
        | 'typeform'
        | 'gmail'
        | 'linkedin'
        | 'manual',
      rawMessage: raw?.message ?? null,
      metadata: (raw?.metadata ?? {}) as Record<string, unknown>,
    };
  }

  async createLeadFromNormalized(normalized: {
    name: string | null;
    email: string | null;
    source: 'typeform' | 'gmail' | 'linkedin' | 'manual';
    rawMessage: string | null;
    metadata: Record<string, unknown>;
  }): Promise<Lead> {
    return this.createLead({
      name: normalized.name ?? undefined,
      email: normalized.email ?? undefined,
      source: normalized.source,
      message: normalized.rawMessage ?? undefined,
      metadata: normalized.metadata,
    });
  }

  async findAll(): Promise<Lead[]> {
    return this.leadRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findQueue(): Promise<Lead[]> {
    return this.leadRepository.find({
      where: {
        reviewQueued: true,
        emailSent: false,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async updateStage(
    id: string,
    stage: Lead['stage'],
  ): Promise<Lead | null> {
    await this.leadRepository.update({ id }, { stage });
    return this.leadRepository.findOne({ where: { id } });
  }

  async findById(id: string): Promise<Lead | null> {
    return this.leadRepository.findOne({ where: { id } });
  }

  async saveLead(lead: Lead): Promise<Lead> {
    return this.leadRepository.save(lead);
  }

  async updateLeadClassification(
    id: string,
    updates: Pick<Lead, 'metadata' | 'priority' | 'stage'>,
  ): Promise<void> {
    await this.leadRepository.update({ id }, updates);
  }

  async updateLeadById(id: string, updates: Partial<Lead>): Promise<void> {
    await this.leadRepository.update({ id }, updates);
  }

  async getStageCounts(): Promise<Record<string, number>> {
    const rows = await this.leadRepository
      .createQueryBuilder('lead')
      .select('lead.stage', 'stage')
      .addSelect('COUNT(*)', 'count')
      .groupBy('lead.stage')
      .getRawMany<{ stage: string; count: string }>();

    const counts: Record<string, number> = {
      inbox: 0,
      qualifying: 0,
      proposal: 0,
      closed: 0,
      dead: 0,
    };

    for (const row of rows) {
      counts[row.stage] = Number(row.count);
    }

    return counts;
  }
}
