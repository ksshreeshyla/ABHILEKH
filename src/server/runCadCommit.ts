import { commitCadIngestion } from './ingestCadPackage.ts';

async function main() {
  console.log('[Commit CAD Ingestion] Starting transactional metadata commit...');
  const result = await commitCadIngestion();
  console.log('CAD_COMMIT_RESULT_START');
  console.log(JSON.stringify(result, null, 2));
  console.log('CAD_COMMIT_RESULT_END');
  if (!result.success) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('[Commit CAD Ingestion] Error:', err);
  process.exit(1);
});
