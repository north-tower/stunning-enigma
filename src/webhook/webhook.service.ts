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
