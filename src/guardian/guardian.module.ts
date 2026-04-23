import { Module } from '@nestjs/common';
import { GuardianService } from './guardian.service';

@Module({
  providers: [GuardianService],
  exports: [GuardianService],
})
export class GuardianModule {}
