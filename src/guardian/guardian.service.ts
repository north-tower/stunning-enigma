import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GuardianService {
  private readonly logger = new Logger(GuardianService.name);

  isActive(): boolean {
    return process.env.SYSTEM_STATUS === 'ACTIVE';
  }

  setStatus(status: 'ACTIVE' | 'PAUSED'): void {
    process.env.SYSTEM_STATUS = status;
    const timestamp = new Date().toISOString();
    this.logger.log(`[Guardian] System ${status} at ${timestamp}`);
  }

  assertActive(): void {
    if (!this.isActive()) {
      throw new Error('SYSTEM_PAUSED');
    }
  }
}
