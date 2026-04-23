import { IsIn, IsString } from 'class-validator';

export class UpdateStageDto {
  @IsString()
  @IsIn(['inbox', 'qualifying', 'proposal', 'closed', 'dead'])
  stage: 'inbox' | 'qualifying' | 'proposal' | 'closed' | 'dead';
}
