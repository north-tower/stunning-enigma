import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AddEmailColumnToLeads1774588800000 } from './migrations/AddEmailColumnToLeads1774588800000';
import { Lead } from './webhook/entities/lead.entity';
import { CreateLeadsTable1773984000000 } from './migrations/CreateLeadsTable';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Lead],
  migrations: [
    CreateLeadsTable1773984000000,
    AddEmailColumnToLeads1774588800000,
  ],
  synchronize: false,
});
