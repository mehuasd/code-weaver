const CORS_PROXY = 'https://corsproxy.io/?';
const PAIZA_CREATE_URL = `${CORS_PROXY}${encodeURIComponent('https://api.paiza.io/runners/create')}`;
const PAIZA_DETAILS_URL = 'https://api.paiza.io/runners/get_details';

const languageMap: Record<string, string> = {
  python: 'python3',
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

async function pollResult(id: string, maxAttempts = 20): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${CORS_PROXY}${encodeURIComponent(`${PAIZA_DETAILS_URL}?id=${id}&api_key=guest`)}`);
    if (!res.ok) throw new Error(`Poll error (${res.status})`);
    const data = await res.json();
    if (data.status === 'completed') return data;
    await delay(1000);
  }
  throw new Error('Execution timed out');
}

export async function executeCode(code: string, language: string): Promise<ExecutionResult> {
  const lang = languageMap[language];
  if (!lang) throw new Error(`Unsupported language: ${language}`);

  const formData = new URLSearchParams();
  formData.append('source_code', code);
  formData.append('language', lang);
  formData.append('input', '');
  formData.append('api_key', 'guest');

  const createRes = await fetch(PAIZA_CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text().catch(() => 'Unknown error');
    throw new Error(`Execution API error (${createRes.status}): ${errorText}`);
  }

  const createData = await createRes.json();
  const result = await pollResult(createData.id);

  return {
    output: result.stdout || '',
    error: result.stderr || result.build_stderr || '',
    exitCode: result.exit_code ?? (result.result === 'failure' ? 1 : 0),
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
