const CODEX_API_URL = 'https://api.codex.jaagrav.in';

const languageMap: Record<string, string> = {
  python: 'py',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
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
  const lang = languageMap[language];
  if (!lang) throw new Error(`Unsupported language: ${language}`);

  const response = await fetch(CODEX_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      language: lang,
      input: '',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Execution API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    output: data.output || '',
    error: data.error || '',
    exitCode: data.error ? 1 : 0,
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
