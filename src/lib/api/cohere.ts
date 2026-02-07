// WARNING: API key stored client-side. Not recommended for production.
const COHERE_API_KEY = 'blnyr0IUzFwtY43OS1xLvKZWcrYDqxWUOFsOlA6N';
const COHERE_API_URL = 'https://api.cohere.com/v2/chat';

export interface VerifyResult {
  correctedCode: string;
  issues: string[];
}

export async function verifyCode(
  sourceCode: string,
  sourceLanguage: string,
  generatedCode: string,
  targetLanguage: string
): Promise<VerifyResult> {
  const langNames: Record<string, string> = {
    python: 'Python',
    c: 'C',
    cpp: 'C++',
    java: 'Java',
  };
  const sourceLangName = langNames[sourceLanguage] || sourceLanguage;
  const targetLangName = langNames[targetLanguage] || targetLanguage;

  const response = await fetch(COHERE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'command-a-03-2025',
      messages: [
        {
          role: 'user',
          content: `You are a strict code translation verifier. You are given original source code in ${sourceLangName} and its translation in ${targetLangName}. Your job is to verify that the ${targetLangName} code is a correct and equivalent translation of the ${sourceLangName} source code.

Check for:
1. Logic equivalence - does the translated code produce the same output as the source?
2. Syntax errors in the translated code
3. Missing functionality - anything in the source that's not in the translation
4. Incorrect translations (wrong function calls, operators, etc.)
5. Type mismatches, missing declarations, incorrect format specifiers

IMPORTANT: Return ONLY a valid JSON object with no extra text, no markdown, no backticks:
{"corrected_code": "the full corrected ${targetLangName} code here", "issues": ["issue 1", "issue 2"]}

If the translation is already correct, return it unchanged with an empty issues array.

Original ${sourceLangName} source code:
${sourceCode}

Translated ${targetLangName} code to verify:
${generatedCode}`,
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
        correctedCode: parsed.corrected_code || generatedCode,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      };
    }
  } catch {
    // JSON parsing failed, return original
  }

  return { correctedCode: generatedCode, issues: [] };
}

export async function verifyAllCode(
  codes: Record<string, string>,
  sourceCode: string,
  sourceLanguage: string
): Promise<Record<string, VerifyResult>> {
  const results: Record<string, VerifyResult> = {};

  // Process sequentially with delay to avoid rate limits
  const entries = Object.entries(codes)
    .filter(([lang]) => lang !== sourceLanguage)
    .filter(([, code]) => code && !code.startsWith('//'));

  for (const [lang, code] of entries) {
    try {
      results[lang] = await verifyCode(sourceCode, sourceLanguage, code, lang);
    } catch (error) {
      results[lang] = {
        correctedCode: code,
        issues: [`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
    // Small delay between requests
    if (entries.indexOf([lang, code] as any) < entries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return results;
}
