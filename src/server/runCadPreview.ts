import { validateAndPreviewCad } from './ingestCadPackage.ts';

const preview = validateAndPreviewCad();
console.log('CAD_VALIDATION_PREVIEW_REPORT_START');
console.log(JSON.stringify(preview, null, 2));
console.log('CAD_VALIDATION_PREVIEW_REPORT_END');

if (!preview.isValid) {
  process.exit(1);
} else {
  process.exit(0);
}
