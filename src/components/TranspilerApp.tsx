import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ShieldCheck, Play, Code2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const sampleCode: Record<Language, string> = {
  python: `# Sample Python Code
print('Welcome to Code Transpiler')

x = 10
if x > 5:
    print('x is greater than 5')

for i in range(0, 5):
    print(i)`,
  c: `#include <stdio.h>

// Sample C Code
int main() {
    printf("Welcome to Code Transpiler\\n");
    
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
    cout << "Welcome to Code Transpiler" << endl;
    
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
        System.out.println("Welcome to Code Transpiler");
        
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
  const navigate = useNavigate();
  const [sourceLanguage, setSourceLanguage] = useState<Language>('python');
  const [sourceCode, setSourceCode] = useState(sampleCode.python);
  const [result, setResult] = useState<TranspileResult | null>(null);
  const [isTranspiling, setIsTranspiling] = useState(false);

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
      const results = await verifyAllCode(codes, sourceCode, sourceLanguage);
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
    codes[sourceLanguage] = sourceCode;
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
    <div className="min-h-screen bg-background">
      {/* Back Button */}
      <div className="max-w-[1600px] mx-auto px-4 pt-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>
      </div>

      {/* Centered Header */}
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-foreground">Code Transpiler</h1>
        <p className="text-muted-foreground text-sm mt-1">Convert code between C, C++, Java, and Python with ease</p>

        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-xs text-muted-foreground mr-1">Source Language</span>
          <Select value={sourceLanguage} onValueChange={(val) => handleLanguageChange(val as Language)}>
            <SelectTrigger className="w-[140px] h-9 bg-secondary border-border text-sm">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {allLanguages.map((lang) => (
                <SelectItem key={lang} value={lang} className="hover:bg-secondary">
                  {languageLabels[lang]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center gap-3 pb-5"
      >
        <ActionButton
          onClick={handleTranspile}
          disabled={!sourceCode.trim() || isTranspiling}
          loading={isTranspiling}
          icon={<Zap className="w-4 h-4" />}
          label="Translate All"
          loadingLabel="Translating..."
          variant="primary"
        />
        <ActionButton
          onClick={handleVerify}
          disabled={!result || isVerifying}
          loading={isVerifying}
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Verify & Fix"
          loadingLabel="Verifying..."
          variant="warning"
        />
        <ActionButton
          onClick={handleRunAll}
          disabled={!result || isRunning}
          loading={isRunning}
          icon={<Play className="w-4 h-4" />}
          label="Run All"
          loadingLabel="Running..."
          variant="success"
        />
      </motion.div>

      {/* 4 Panel Layout - equal height */}
      <div className="px-4 pb-6 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 auto-rows-fr">
          {allLanguages.map((lang, i) => {
            const isSource = lang === sourceLanguage;
            const code = isSource ? sourceCode : (result?.[lang] || '');
            const isUnsupported = code === '// C does not support classes' ||
                                  code === '// C does not support this feature';

            return (
              <motion.div
                key={lang}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex"
              >
                <CodePanel
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
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Small reusable action button */
function ActionButton({
  onClick,
  disabled,
  loading,
  icon,
  label,
  loadingLabel,
  variant,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  icon: React.ReactNode;
  label: string;
  loadingLabel: string;
  variant: 'primary' | 'warning' | 'success';
}) {
  const colors = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    warning: 'bg-yellow-500 text-black hover:bg-yellow-400',
    success: 'bg-green-500 text-black hover:bg-green-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-all text-sm',
        !disabled ? colors[variant] : 'bg-secondary text-muted-foreground cursor-not-allowed'
      )}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {icon}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
