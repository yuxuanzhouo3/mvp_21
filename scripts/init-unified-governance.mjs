import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const requiredFiles = [
  'docs/UNIFIED_DATA_MODEL.md',
  'cloudbase-collections.json',
  'lib/data/unified-models.ts',
  'lib/database/cloudbase-schema.ts',
  'supabase/migrations/20260330_admin_audit_and_company_profile_governance.sql',
];

const missingFiles = requiredFiles.filter((file) => !existsSync(resolve(root, file)));

if (missingFiles.length > 0) {
  console.error('[init-unified-governance] Missing required governance files:');
  for (const file of missingFiles) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const cloudbaseConfig = JSON.parse(
  readFileSync(resolve(root, 'cloudbase-collections.json'), 'utf8'),
);

const collectionNames = (cloudbaseConfig.collections || []).map((item) => item.name);

console.log('[init-unified-governance] Governance files are present.');
console.log('[init-unified-governance] Apply the Supabase migration:');
console.log('  supabase/migrations/20260330_admin_audit_and_company_profile_governance.sql');
console.log('[init-unified-governance] Initialize or verify CloudBase collections:');
for (const name of collectionNames) {
  console.log(`- ${name}`);
}
console.log('[init-unified-governance] Canonical field spec:');
console.log('  docs/UNIFIED_DATA_MODEL.md');
