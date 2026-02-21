const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com/submissions';

// Language IDs for Judge0 CE
const languageConfig: Record<string, number> = {
  python: 71,  // Python 3
  c: 50,       // C (GCC 9.2.0)
  cpp: 54,     // C++ (GCC 9.2.0)
  java: 62,    // Java (OpenJDK 13.0.1)
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
  const langId = languageConfig[language];
  if (!langId) throw new Error(`Unsupported language: ${language}`);

  // Submit code
  const submitResponse = await fetch(`${JUDGE0_API_URL}?base64_encoded=true&wait=true&fields=stdout,stderr,exit_code,status,compile_output`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': import.meta.env.VITE_RAPIDAPI_KEY || '',
      'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
    },
    body: JSON.stringify({
      language_id: langId,
      source_code: btoa(unescape(encodeURIComponent(code))),
    }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text().catch(() => 'Unknown error');
    throw new Error(`Execution API error (${submitResponse.status}): ${errorText}`);
  }

  const data = await submitResponse.json();

  const decode = (s: string | null) => {
    if (!s) return '';
    try {
      return decodeURIComponent(escape(atob(s)));
    } catch {
      return s;
    }
  };

  const stdout = decode(data.stdout);
  const stderr = decode(data.stderr);
  const compileErr = decode(data.compile_output);

  return {
    output: stdout,
    error: stderr || compileErr || '',
    exitCode: data.exit_code ?? (data.status?.id >= 6 ? 1 : 0),
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
