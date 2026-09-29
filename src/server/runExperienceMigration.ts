import 'dotenv/config';
import { executeExperienceMigration } from './migrationRunner.ts';

const result = await executeExperienceMigration();
console.log(result.message);
if (!result.success) {
  if (result.error) console.error(result.error);
  process.exitCode = 1;
}
