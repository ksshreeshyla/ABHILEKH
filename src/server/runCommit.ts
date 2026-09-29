import { commitIngestion } from './ingestNdliPackage';

async function main() {
  console.log('[Commit Ingestion] Starting transactional metadata commit...');
  const result = await commitIngestion();
  console.log('COMMIT_RESULT_START');
  console.log(JSON.stringify(result, null, 2));
  console.log('COMMIT_RESULT_END');
}

main().catch(err => {
  console.error('[Commit Ingestion] Error:', err);
  process.exit(1);
});
