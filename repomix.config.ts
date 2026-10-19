export interface RepomixConfig {
  input?: {
    maxFileSize?: number;
  };
  output?: {
    filePath?: string;
    style?: 'xml' | 'markdown' | 'plain';
    parsableStyle?: boolean;
    fileSummary?: boolean;
    directoryStructure?: boolean;
    files?: boolean;
    removeComments?: boolean;
    removeEmptyLines?: boolean;
    compress?: boolean;
    topFilesLength?: number;
    showLineNumbers?: boolean;
    copyToClipboard?: boolean;
    git?: {
      sortByChanges?: boolean;
      sortByChangesMaxCommits?: number;
      includeDiffs?: boolean;
    };
  };
  include?: string[];
  ignore?: {
    useGitignore?: boolean;
    useDefaultPatterns?: boolean;
    customPatterns?: string[];
  };
  security?: {
    enableSecurityCheck?: boolean;
  };
}

const config: RepomixConfig = {
  input: {
    maxFileSize: 50 * 1024 * 1024, // 50MB guard
  },
  output: {
    filePath: 'repomix-output.xml',
    style: 'xml',
    parsableStyle: false,
    fileSummary: true,
    directoryStructure: true,
    files: true,
    removeComments: false,
    removeEmptyLines: false,
    compress: false,
    topFilesLength: 10,
    showLineNumbers: false,
    copyToClipboard: false,
    git: {
      sortByChanges: true,
      sortByChangesMaxCommits: 100,
      includeDiffs: false,
    },
  },
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
    'CLAUDE.md',
    '.github/**/*',
    '.vscode/*',
    'src/**/*',
    'scripts/*.mjs',
    'scripts/**/*.mjs',
    'supabase/functions/**/*.ts',
    'supabase/migrations/**/*.sql',
  ],
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
      'repomix-output.*',
      '**/*.log',
      'public/**',
    ],
  },
  security: {
    enableSecurityCheck: true,
  },
};

export default config;
