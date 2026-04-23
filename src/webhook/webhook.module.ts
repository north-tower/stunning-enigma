import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassifierModule } from '../classifier/classifier.module';
import { Lead } from './entities/lead.entity';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead]),
    forwardRef(() => ClassifierModule),
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}

// Register in AppModule:
// imports: [TypeOrmModule.forRoot(...), WebhookModule]
