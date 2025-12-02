import { useState, useCallback } from 'react';
import { ArrowRight, Zap, AlertCircle, Code2, Sparkles } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { LanguageSelector } from './LanguageSelector';
import { OutputPanel } from './OutputPanel';
import { transpiler, Language, TranspileResult } from '@/lib/transpiler';
import { cn } from '@/lib/utils';

const sampleCode: Record<Language, string> = {
  python: `# Hello World example
def greet(name):
    print(f"Hello, {name}!")
    return True

# Main program
x = 10
for i in range(5):
    if i % 2 == 0:
        print(i)
    else:
        print("odd")

greet("World")`,
  c: `#include <stdio.h>

// Hello World example
int greet(char name[]) {
    printf("Hello, %s!\\n", name);
    return 1;
}

int main() {
    int x = 10;
    for (int i = 0; i < 5; i++) {
        if (i % 2 == 0) {
            printf("%d\\n", i);
        } else {
            printf("odd\\n");
        }
    }
    greet("World");
    return 0;
}`,
  cpp: `#include <iostream>
using namespace std;

// Hello World example
bool greet(string name) {
    cout << "Hello, " << name << "!" << endl;
    return true;
}

int main() {
    int x = 10;
    for (int i = 0; i < 5; i++) {
        if (i % 2 == 0) {
            cout << i << endl;
        } else {
            cout << "odd" << endl;
        }
    }
    greet("World");
    return 0;
}`,
  java: `public class Main {
    // Hello World example
    public static boolean greet(String name) {
        System.out.println("Hello, " + name + "!");
        return true;
    }

    public static void main(String[] args) {
        int x = 10;
        for (int i = 0; i < 5; i++) {
            if (i % 2 == 0) {
                System.out.println(i);
            } else {
                System.out.println("odd");
            }
        }
        greet("World");
    }
}`,
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
    
    // Simulate slight delay for UX
    setTimeout(() => {
      const transpileResult = transpiler.transpile(sourceCode, sourceLanguage);
      setResult(transpileResult);
      setIsTranspiling(false);
    }, 300);
  }, [sourceCode, sourceLanguage]);

  const outputLanguages = (['python', 'c', 'cpp', 'java'] as Language[]).filter(
    (lang) => lang !== sourceLanguage
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Background pattern */}
      <div className="fixed inset-0 bg-grid-pattern bg-[size:50px_50px] opacity-[0.02] pointer-events-none" />
      
      {/* Gradient orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Code2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="text-gradient-primary">Code</span>
              <span className="text-foreground">Transpiler</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Convert code seamlessly between Python, C, C++, and Java with intelligent rule-based translation
          </p>
        </header>

        {/* Source Language Selector */}
        <div className="flex flex-col items-center gap-4 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <span className="text-sm font-medium text-muted-foreground">Source Language</span>
          <LanguageSelector value={sourceLanguage} onChange={handleLanguageChange} />
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="flex flex-col animate-slide-in" style={{ animationDelay: '0.2s' }}>
            <div className="glass-panel flex-1 flex flex-col min-h-[400px] lg:min-h-[500px]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Source Code</span>
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                  {sourceCode.split('\n').length} lines
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <CodeEditor
                  value={sourceCode}
                  onChange={setSourceCode}
                  language={sourceLanguage}
                  className="h-full"
                />
              </div>
            </div>

            {/* Transpile Button */}
            <button
              onClick={handleTranspile}
              disabled={!sourceCode.trim() || isTranspiling}
              className={cn(
                'mt-4 flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300',
                sourceCode.trim() && !isTranspiling
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 glow-primary hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-secondary text-muted-foreground cursor-not-allowed'
              )}
            >
              {isTranspiling ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Transpiling...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Transpile Code</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {/* Output Panels */}
          <div className="flex flex-col gap-4 animate-slide-in" style={{ animationDelay: '0.3s' }}>
            {/* Errors */}
            {result?.errors && result.errors.length > 0 && (
              <div className="glass-panel p-4 border-destructive/50 bg-destructive/10">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">Errors</span>
                </div>
                <ul className="text-sm text-destructive/80 space-y-1">
                  {result.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Output panels */}
            <div className="grid gap-4 flex-1">
              {outputLanguages.map((lang) => (
                <OutputPanel
                  key={lang}
                  language={lang}
                  code={result?.[lang] || ''}
                  isActive={!!result?.[lang]}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <p>
            Powered by client-side TypeScript transpilation • Supports variables, functions, control flow, and classes
          </p>
        </footer>
      </div>
    </div>
  );
}
