const PISTON_API_URL = 'https://emkc.org/api/v2/piston/execute';

const languageConfig: Record<string, { language: string; version: string }> = {
  python: { language: 'python', version: '3.10.0' },
  c: { language: 'c', version: '10.2.0' },
  cpp: { language: 'c++', version: '10.2.0' },
  java: { language: 'java', version: '15.0.2' },
};

export interface ExecutionResult {
  output: string;
  error: string;
  exitCode: number;
}

export async function executeCode(code: string, language: string): Promise<ExecutionResult> {
  const config = languageConfig[language];
  if (!config) throw new Error(`Unsupported language: ${language}`);

  const response = await fetch(PISTON_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: config.language,
      version: config.version,
      files: [{ content: code }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Execution API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    output: data.run?.stdout || data.run?.output || '',
    error: data.run?.stderr || data.compile?.stderr || '',
    exitCode: data.run?.code ?? -1,
  };
}

export async function executeAllCode(
  codes: Record<string, string>
): Promise<Record<string, ExecutionResult>> {
  const results: Record<string, ExecutionResult> = {};

  const promises = Object.entries(codes)
    .filter(([, code]) => code && !code.startsWith('//'))
    .map(async ([lang, code]) => {
      try {
        results[lang] = await executeCode(code, lang);
      } catch (error) {
        results[lang] = {
          output: '',
          error: error instanceof Error ? error.message : 'Execution failed',
          exitCode: -1,
        };
      }
    });

  await Promise.all(promises);
  return results;
}
