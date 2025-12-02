import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { cn } from '@/lib/utils';
import type { Language } from '@/lib/transpiler';

interface OutputPanelProps {
  language: Language;
  code: string;
  isActive?: boolean;
}

const languageInfo: Record<Language, { label: string; icon: string; color: string }> = {
  python: { label: 'Python', icon: '🐍', color: 'from-yellow-500/20 to-blue-500/20' },
  c: { label: 'C', icon: '⚙️', color: 'from-blue-500/20 to-gray-500/20' },
  cpp: { label: 'C++', icon: '⚡', color: 'from-blue-600/20 to-purple-500/20' },
  java: { label: 'Java', icon: '☕', color: 'from-orange-500/20 to-red-500/20' },
};

export function OutputPanel({ language, code, isActive }: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const info = languageInfo[language];

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'glass-panel flex flex-col overflow-hidden transition-all duration-300',
        isActive && 'ring-2 ring-primary/50'
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r', info.color)}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{info.icon}</span>
          <span className="font-semibold text-foreground">{info.label}</span>
        </div>
        <button
          onClick={handleCopy}
          disabled={!code}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            code
              ? 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
              : 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
          )}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code area */}
      <div className="flex-1 min-h-0">
        <CodeEditor
          value={code}
          language={language}
          readOnly
          placeholder="Output will appear here..."
          className="h-full"
        />
      </div>
    </div>
  );
}
