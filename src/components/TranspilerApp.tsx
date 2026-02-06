import { useState, useCallback } from 'react';
import { Zap, ShieldCheck, Play } from 'lucide-react';
import { CodePanel } from './CodePanel';
import { transpiler, Language, TranspileResult } from '@/lib/transpiler';
import { verifyAllCode, VerifyResult } from '@/lib/api/cohere';
import { executeAllCode, ExecutionResult } from '@/lib/api/piston';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const sampleCode: Record<Language, string> = {
  python: `# Sample Python Code
print('Welcome to Code Translator')

x = 10
if x > 5:
    print('x is greater than 5')

for i in range(0, 5):
    print(i)`,
  c: `#include <stdio.h>

// Sample C Code
int main() {
    printf("Welcome to Code Translator\\n");
    
    int x = 10;
    if (x > 5) {
        printf("x is greater than 5\\n");
    }
    
    for (int i = 0; i < 5; i++) {
        printf("%d\\n", i);
    }
    return 0;
}`,
  cpp: `#include <iostream>
using namespace std;

// Sample C++ Code
int main() {
    cout << "Welcome to Code Translator" << endl;
    
    int x = 10;
    if (x > 5) {
        cout << "x is greater than 5" << endl;
    }
    
    for (int i = 0; i < 5; i++) {
        cout << i << endl;
    }
    return 0;
}`,
  java: `public class Main {
    // Sample Java Code
    public static void main(String[] args) {
        System.out.println("Welcome to Code Translator");
        
        int x = 10;
        if (x > 5) {
            System.out.println("x is greater than 5");
        }
        
        for (int i = 0; i < 5; i++) {
            System.out.println(i);
        }
    }
}`,
};

const languageLabels: Record<Language, string> = {
  python: 'Python',
  c: 'C',
  cpp: 'C++',
  java: 'Java',
};

const allLanguages: Language[] = ['python', 'c', 'cpp', 'java'];

export function TranspilerApp() {
  const [sourceLanguage, setSourceLanguage] = useState<Language>('python');
  const [sourceCode, setSourceCode] = useState(sampleCode.python);
  const [result, setResult] = useState<TranspileResult | null>(null);
  const [isTranspiling, setIsTranspiling] = useState(false);

  // Verification & Execution state
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});
  const [execResults, setExecResults] = useState<Record<string, ExecutionResult>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const handleLanguageChange = (lang: Language) => {
    setSourceLanguage(lang);
    setSourceCode(sampleCode[lang]);
    setResult(null);
    setVerifyResults({});
    setExecResults({});
  };

  const handleTranspile = useCallback(() => {
    if (!sourceCode.trim()) return;
    setIsTranspiling(true);
    setVerifyResults({});
    setExecResults({});

    setTimeout(() => {
      const transpileResult = transpiler.transpile(sourceCode, sourceLanguage);
      setResult(transpileResult);
      setIsTranspiling(false);
    }, 300);
  }, [sourceCode, sourceLanguage]);

  const handleVerify = useCallback(async () => {
    if (!result) return;
    setIsVerifying(true);

    const codes: Record<string, string> = {};
    for (const lang of allLanguages) {
      if (lang !== sourceLanguage) {
        const code = result[lang];
        if (code && !code.startsWith('//')) {
          codes[lang] = code;
        }
      }
    }

    try {
      const results = await verifyAllCode(codes, sourceLanguage);
      setVerifyResults(results);
    } catch (error) {
      console.error('Verification error:', error);
    } finally {
      setIsVerifying(false);
    }
  }, [result, sourceLanguage]);

  const handleRunAll = useCallback(async () => {
    if (!result) return;
    setIsRunning(true);

    const codes: Record<string, string> = {};
    // Source code
    codes[sourceLanguage] = sourceCode;
    // Output codes (use verified versions if available)
    for (const lang of allLanguages) {
      if (lang !== sourceLanguage) {
        const verifiedCode = verifyResults[lang]?.correctedCode;
        const originalCode = result[lang];
        const code = verifiedCode || originalCode;
        if (code && !code.startsWith('//')) {
          codes[lang] = code;
        }
      }
    }

    try {
      const results = await executeAllCode(codes);
      setExecResults(results);
    } catch (error) {
      console.error('Execution error:', error);
    } finally {
      setIsRunning(false);
    }
  }, [result, sourceLanguage, sourceCode, verifyResults]);

  return (
    <div className="min-h-screen bg-[#1e1e1e]">
      {/* Header */}
      <header className="text-center py-6">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          Code Translator
        </h1>
        <p className="text-muted-foreground text-sm">
          Convert code between C, C++, Java, and Python with ease
        </p>
      </header>

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <span className="text-sm text-muted-foreground">Source Language</span>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Select value={sourceLanguage} onValueChange={(val) => handleLanguageChange(val as Language)}>
            <SelectTrigger className="w-[180px] bg-[#2d2d2d] border-border">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent className="bg-[#2d2d2d] border-border">
              {allLanguages.map((lang) => (
                <SelectItem key={lang} value={lang} className="hover:bg-[#3d3d3d]">
                  {languageLabels[lang]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Translate Button */}
          <button
            onClick={handleTranspile}
            disabled={!sourceCode.trim() || isTranspiling}
            className={cn(
              'flex items-center justify-center gap-2 px-5 py-2 rounded-md font-medium transition-all text-sm',
              sourceCode.trim() && !isTranspiling
                ? 'bg-[#00bcd4] text-black hover:bg-[#00acc1]'
                : 'bg-[#2d2d2d] text-muted-foreground cursor-not-allowed'
            )}
          >
            {isTranspiling ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Translating...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Translate All</span>
              </>
            )}
          </button>

          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={!result || isVerifying}
            className={cn(
              'flex items-center justify-center gap-2 px-5 py-2 rounded-md font-medium transition-all text-sm',
              result && !isVerifying
                ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                : 'bg-[#2d2d2d] text-muted-foreground cursor-not-allowed'
            )}
          >
            {isVerifying ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Verify & Fix</span>
              </>
            )}
          </button>

          {/* Run All Button */}
          <button
            onClick={handleRunAll}
            disabled={!result || isRunning}
            className={cn(
              'flex items-center justify-center gap-2 px-5 py-2 rounded-md font-medium transition-all text-sm',
              result && !isRunning
                ? 'bg-green-500 text-black hover:bg-green-400'
                : 'bg-[#2d2d2d] text-muted-foreground cursor-not-allowed'
            )}
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4 Panel Layout */}
      <div className="px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {allLanguages.map((lang) => {
            const isSource = lang === sourceLanguage;
            const code = isSource ? sourceCode : (result?.[lang] || '');
            const isUnsupported = code === '// C does not support classes' ||
                                  code === '// C does not support this feature';

            return (
              <CodePanel
                key={lang}
                language={lang}
                languageLabel={languageLabels[lang]}
                code={code}
                isSource={isSource}
                isUnsupported={isUnsupported}
                onChange={isSource ? setSourceCode : undefined}
                verifyResult={!isSource ? verifyResults[lang] : undefined}
                executionResult={execResults[lang]}
                isVerifying={!isSource && isVerifying}
                isRunning={isRunning}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
