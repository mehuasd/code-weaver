import { useState, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { OutputPanel } from './OutputPanel';
import { transpiler, Language, TranspileResult } from '@/lib/transpiler';
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

export function TranspilerApp() {
  const [sourceLanguage, setSourceLanguage] = useState<Language>('python');
  const [sourceCode, setSourceCode] = useState(sampleCode.python);
  const [result, setResult] = useState<TranspileResult | null>(null);
  const [isTranspiling, setIsTranspiling] = useState(false);

  const handleLanguageChange = (lang: Language) => {
    setSourceLanguage(lang);
    setSourceCode(sampleCode[lang]);
    setResult(null);
  };

  const handleTranspile = useCallback(() => {
    if (!sourceCode.trim()) return;

    setIsTranspiling(true);
    
    setTimeout(() => {
      const transpileResult = transpiler.transpile(sourceCode, sourceLanguage);
      setResult(transpileResult);
      setIsTranspiling(false);
    }, 300);
  }, [sourceCode, sourceLanguage]);

  const allLanguages: Language[] = ['python', 'c', 'cpp', 'java'];

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

      {/* Source Language Selector & Translate Button */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <span className="text-sm text-muted-foreground">Source Language</span>
        <div className="flex items-center gap-4">
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
          
          <button
            onClick={handleTranspile}
            disabled={!sourceCode.trim() || isTranspiling}
            className={cn(
              'flex items-center justify-center gap-2 px-6 py-2 rounded-md font-medium transition-all',
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
                <span>Translate to All Languages</span>
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
              <div
                key={lang}
                className={cn(
                  "flex flex-col rounded-lg overflow-hidden min-h-[400px] border transition-all",
                  isSource 
                    ? "bg-[#1a2a2a] border-[#00bcd4]/50 ring-1 ring-[#00bcd4]/30" 
                    : "bg-[#2d2d2d] border-[#3d3d3d]"
                )}
              >
                {/* Panel Header */}
                <div className={cn(
                  "flex items-center justify-between px-4 py-2 border-b",
                  isSource ? "border-[#00bcd4]/30 bg-[#00bcd4]/10" : "border-[#3d3d3d]"
                )}>
                  <span className={cn(
                    "font-semibold",
                    isSource ? "text-[#00bcd4]" : "text-foreground"
                  )}>
                    {languageLabels[lang]}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    isSource 
                      ? 'bg-[#00bcd4] text-black' 
                      : 'bg-[#3d3d3d] text-muted-foreground'
                  )}>
                    {isSource ? 'Source' : 'Output'}
                  </span>
                </div>
                
                {/* Code Area */}
                <div className="flex-1 overflow-hidden">
                  {isUnsupported ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground p-4 text-center">
                      {code.replace('// ', '')}
                    </div>
                  ) : (
                    <CodeEditor
                      value={isSource ? sourceCode : code}
                      onChange={isSource ? setSourceCode : undefined}
                      language={lang}
                      readOnly={!isSource}
                      placeholder={isSource ? "Enter your code here..." : ""}
                      className="h-full"
                    />
                  )}
                </div>
                
                {/* Copy Button */}
                <CopyButton code={isSource ? sourceCode : code} disabled={!code || isUnsupported} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ code, disabled }: { code: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    if (!code || disabled) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      disabled={disabled}
      className={cn(
        'w-full py-2 text-sm font-medium border-t border-[#3d3d3d] transition-colors',
        disabled
          ? 'bg-[#2d2d2d] text-muted-foreground cursor-not-allowed'
          : 'bg-[#3d3d3d] text-foreground hover:bg-[#4d4d4d]'
      )}
    >
      {copied ? 'Copied!' : 'Copy Code'}
    </button>
  );
}
