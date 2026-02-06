// WARNING: API key stored client-side. Not recommended for production.
// Consider using a backend service for secure API key management.
const COHERE_API_KEY = 'blnyr0IUzFwtY43OS1xLvKZWcrYDqxWUOFsOlA6N';
const COHERE_API_URL = 'https://api.cohere.com/v2/chat';

export interface VerifyResult {
  correctedCode: string;
  issues: string[];
}

export async function verifyCode(code: string, language: string): Promise<VerifyResult> {
  const langNames: Record<string, string> = {
    python: 'Python',
    c: 'C',
    cpp: 'C++',
    java: 'Java',
  };
  const langName = langNames[language] || language;

  const response = await fetch(COHERE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'command-r-plus',
      messages: [
        {
          role: 'user',
          content: `You are a strict ${langName} code reviewer. Check this code for syntax errors, type mismatches, missing declarations, incorrect format specifiers, and logical errors.

IMPORTANT: Return ONLY a valid JSON object with no extra text, no markdown, no backticks:
{"corrected_code": "the full corrected code here", "issues": ["issue 1", "issue 2"]}

If the code is already correct, return it unchanged with an empty issues array.

Code to review:
${code}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Cohere API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.message?.content?.[0]?.text || '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        correctedCode: parsed.corrected_code || code,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      };
    }
  } catch {
    // JSON parsing failed, return original
  }

  return { correctedCode: code, issues: [] };
}

export async function verifyAllCode(
  codes: Record<string, string>,
  sourceLanguage: string
): Promise<Record<string, VerifyResult>> {
  const results: Record<string, VerifyResult> = {};

  const promises = Object.entries(codes)
    .filter(([lang]) => lang !== sourceLanguage)
    .filter(([, code]) => code && !code.startsWith('//'))
    .map(async ([lang, code]) => {
      try {
        results[lang] = await verifyCode(code, lang);
      } catch (error) {
        results[lang] = {
          correctedCode: code,
          issues: [`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        };
      }
    });

  await Promise.all(promises);
  return results;
}
