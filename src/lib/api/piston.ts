const WANDBOX_API_URL = 'https://wandbox.org/api/compile/json';

// Compiler names for Wandbox
const compilerConfig: Record<string, string> = {
  python: 'cpython-head',
  c: 'gcc-head-c',
  cpp: 'gcc-head',
  java: 'openjdk-head',
};

export interface ExecutionResult {
  output: string;
  error: string;
  exitCode: number;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeCode(code: string, language: string): Promise<ExecutionResult> {
  const compiler = compilerConfig[language];
  if (!compiler) throw new Error(`Unsupported language: ${language}`);

  const response = await fetch(WANDBOX_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compiler,
      code,
      options: language === 'c' ? '' : '',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Execution API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const stdout = data.program_message || '';
  const compilerMsg = data.compiler_message || '';
  const status = parseInt(data.status || '0', 10);

  return {
    output: stdout,
    error: status !== 0 ? (compilerMsg || 'Execution failed') : '',
    exitCode: status,
  };
}

export async function executeAllCode(
  codes: Record<string, string>
): Promise<Record<string, ExecutionResult>> {
  const results: Record<string, ExecutionResult> = {};

  const entries = Object.entries(codes)
    .filter(([, code]) => code && !code.startsWith('//'));

  for (let i = 0; i < entries.length; i++) {
    const [lang, code] = entries[i];

    try {
      results[lang] = await executeCode(code, lang);
    } catch (error) {
      results[lang] = {
        output: '',
        error: error instanceof Error ? error.message : 'Execution failed',
        exitCode: -1,
      };
    }

    if (i < entries.length - 1) {
      await delay(500);
    }
  }

  return results;
}
