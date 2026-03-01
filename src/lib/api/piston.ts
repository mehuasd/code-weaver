const PAIZA_BASE = 'https://api.paiza.io/runners';

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

// Dynamically load Puter.js for CORS-free fetch
let puterLoaded = false;
async function ensurePuter(): Promise<void> {
  if (puterLoaded) return;
  if (!(window as any).puter) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.onload = () => { puterLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('Failed to load Puter.js'));
      document.head.appendChild(script);
    });
  } else {
    puterLoaded = true;
  }
}

async function corsFetch(url: string, options?: RequestInit): Promise<Response> {
  await ensurePuter();
  const puter = (window as any).puter;
  if (puter?.net?.fetch) {
    return puter.net.fetch(url, options);
  }
  // Fallback to direct fetch
  return fetch(url, options);
}

async function pollResult(id: string, maxAttempts = 20): Promise<any> {
  const url = `${PAIZA_BASE}/get_details?id=${id}&api_key=guest`;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await corsFetch(url);
    if (!res.ok) throw new Error(`Poll error (${res.status})`);
    const data = await res.json();
    if (data.status === 'completed') return data;
    await delay(1000);
  }
  throw new Error('Execution timed out');
}

export async function executeCode(code: string, language: string, retries = 2): Promise<ExecutionResult> {
  const lang = languageMap[language];
  if (!lang) throw new Error(`Unsupported language: ${language}`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const formData = new URLSearchParams();
      formData.append('source_code', code);
      formData.append('language', lang);
      formData.append('input', '');
      formData.append('api_key', 'guest');

      const createRes = await corsFetch(`${PAIZA_BASE}/create`, {
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
    } catch (error) {
      if (attempt < retries) {
        await delay(1000 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  throw new Error('Execution failed after retries');
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
