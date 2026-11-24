import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const outDir = path.join(rootDir, '.audit-pack');
const skipDb = process.argv.includes('--skip-db');
const isWindows = process.platform === 'win32';

// Load .env / .env.local automatically (without overriding existing shell env vars)
function loadLocalEnv() {
  for (const envFile of ['.env', '.env.local']) {
    const fullPath = path.join(rootDir, envFile);
    if (!fs.existsSync(fullPath)) continue;

    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;

      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  }
}

loadLocalEnv();

// Clean & recreate .audit-pack/
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// Isolated Repomix config (explicitly omits splitOutput so each partition is 1 single file)
const tmpRepomixConfigPath = path.join(outDir, '.repomix-part.config.json');
fs.writeFileSync(
  tmpRepomixConfigPath,
  JSON.stringify(
    {
      input: { maxFileSize: 50 * 1024 * 1024 },
      output: {
        style: 'xml',
        parsableStyle: false,
        fileSummary: false,
        directoryStructure: true,
        files: true,
        removeComments: false,
        removeEmptyLines: true,
        compress: false,
        showLineNumbers: false,
        copyToClipboard: false,
        git: { sortByChanges: false, includeDiffs: false },
      },
      ignore: {
        useGitignore: true,
        useDefaultPatterns: true,
        customPatterns: [
          'node_modules/**',
          'dist/**',
          '.astro/**',
          'android/**',
          'ios/**',
          '.git/**',
          '.env',
          '.env.*',
          'package-lock.json',
          'pnpm-lock.yaml',
          'yarn.lock',
          'repomix-output*',
          '.audit-pack/**',
          '**/*.log',
          '**/*.sql',
          'supabase/migrations/**',
          'scripts/generate-brand-assets.mjs',
          'CLAUDE.md',
          'public/**',
        ],
      },
      security: { enableSecurityCheck: true },
    },
    null,
    2
  ),
  'utf8'
);

// 3 balanced partitions (~45-70 KB each, 1 file per partition)
const REPOMIX_PARTS = [
  {
    file: '1-config-pages-edge.xml',
    label: 'Configs, CI/CD, Native Scripts, Astro Pages, Styles & Edge Functions',
    include: [
      'README.md',
      'package.json',
      'tsconfig.json',
      'astro.config.*',
      'capacitor.config.*',
      'repomix.config.ts',
      '.eslint.cjs',
      '.prettierrc',
      '.editorconfig',
      '.nvmrc',
      'AGENTS.md',
      '.github/**/*',
      '.vscode/*',
      'scripts/configure-native.mjs',
      'supabase/functions/**/*.ts',
      'src/pages/**/*',
      'src/layouts/**/*',
      'src/styles/**/*',
      'src/env.d.ts',
    ].join(','),
  },
  {
    file: '2-lib-and-session.xml',
    label: 'Core Libraries, Math/CSV/Billing Engines, Session Hooks & UI Primitives',
    include: ['src/lib/**/*', 'src/components/session/**/*', 'src/components/ui/**/*'].join(','),
  },
  {
    file: '3-views-and-router.xml',
    label: 'Top-Level Views (AppRouter, Home, ActiveSession, Friends, Ledger, Analytics, Profile)',
    include: ['src/components/*.tsx'].join(','),
  },
];

console.log('[Ekwly Audit Pack] Generating 3 single-file Repomix bundles...\n');

const generatedFiles = [];

for (const part of REPOMIX_PARTS) {
  const outPath = path.join(outDir, part.file);
  console.log(`  -> Packing ${part.file} (${part.label})`);
  execSync(
    `pnpm dlx repomix -c "${tmpRepomixConfigPath}" --include "${part.include}" -o "${outPath}"`,
    { cwd: rootDir, stdio: 'inherit' }
  );
  if (fs.existsSync(outPath)) {
    generatedFiles.push(outPath);
  }
}

fs.rmSync(tmpRepomixConfigPath, { force: true });

// Automated Supabase Schema + Roles Dump
const finalSqlPath = path.join(outDir, '4-supabase-audit.sql');

if (skipDb) {
  console.log('\n[Ekwly Audit Pack] Skipping Supabase DB dump (--skip-db passed).');
} else {
  console.log('\n[Ekwly Audit Pack] Dumping Supabase roles & schema...');
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  const targetFlag = dbUrl ? `--db-url "${dbUrl}"` : '--linked';

  const rolesTmp = path.join(outDir, '.tmp-roles.sql');
  const schemaTmp = path.join(outDir, '.tmp-schema.sql');

  try {
    if (!dbUrl) {
      console.log('  (SUPABASE_DB_URL not set in .env — using linked Supabase CLI project)');
    }

    execSync(`pnpm dlx supabase db dump ${targetFlag} --role-only -f "${rolesTmp}"`, {
      cwd: rootDir,
      stdio: 'inherit',
    });

    execSync(`pnpm dlx supabase db dump ${targetFlag} -f "${schemaTmp}"`, {
      cwd: rootDir,
      stdio: 'inherit',
    });

    const rolesSql = fs.existsSync(rolesTmp) ? fs.readFileSync(rolesTmp, 'utf8') : '';
    const schemaSql = fs.existsSync(schemaTmp) ? fs.readFileSync(schemaTmp, 'utf8') : '';

    const combinedSql = [
      '-- ============================================================',
      `-- EKWLY SUPABASE AUDIT DUMP (${new Date().toISOString()})`,
      '-- ============================================================\n',
      rolesSql,
      '\n-- ============================================================\n',
      schemaSql,
    ].join('\n');

    fs.writeFileSync(finalSqlPath, combinedSql, 'utf8');
    fs.rmSync(rolesTmp, { force: true });
    fs.rmSync(schemaTmp, { force: true });
    generatedFiles.push(finalSqlPath);
    console.log('  -> Saved 4-supabase-audit.sql');
  } catch {
    fs.rmSync(rolesTmp, { force: true });
    fs.rmSync(schemaTmp, { force: true });
    console.warn('\n⚠️  Supabase DB dump skipped/failed. Ensure Docker is running and either:');
    console.warn(
      '   1. Set SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" in .env'
    );
    console.warn('   2. Or run `pnpm dlx supabase link --project-ref <your-ref>` once.');
  }
}

// Create single ZIP archive containing the 4 files
const zipPath = path.join(outDir, 'ekwly-audit-pack.zip');
if (generatedFiles.length > 0) {
  console.log('\n[Ekwly Audit Pack] Creating ekwly-audit-pack.zip...');
  if (isWindows) {
    const psPaths = generatedFiles.map((f) => `'${f.replace(/'/g, "''")}'`).join(', ');
    execSync(
      `powershell.exe -NoProfile -NonInteractive -Command "Compress-Archive -Path ${psPaths} -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
      { cwd: rootDir, stdio: 'inherit' }
    );
  } else {
    const posixPaths = generatedFiles.map((f) => `"${f}"`).join(' ');
    execSync(`zip -j -q "${zipPath}" ${posixPaths}`, { cwd: rootDir, stdio: 'inherit' });
  }
}

// Print summary
console.log('\n✅ Audit Pack Ready in .audit-pack/:\n');
for (const fileName of fs.readdirSync(outDir).sort()) {
  const stats = fs.statSync(path.join(outDir, fileName));
  const kb = (stats.size / 1024).toFixed(1);
  console.log(`   • .audit-pack/${fileName} (${kb} KB)`);
}
