import { useState } from 'react';
import { Play, CheckCircle, AlertTriangle, Terminal } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { cn } from '@/lib/utils';
import type { Language } from '@/lib/transpiler';
import type { VerifyResult } from '@/lib/api/cohere';
import type { ExecutionResult } from '@/lib/api/piston';

interface CodePanelProps {
  language: Language;
  languageLabel: string;
  code: string;
  isSource: boolean;
  isUnsupported: boolean;
  onChange?: (value: string) => void;
  verifyResult?: VerifyResult;
  executionResult?: ExecutionResult;
  isVerifying?: boolean;
  isRunning?: boolean;
}

export function CodePanel({
  language,
  languageLabel,
  code,
  isSource,
  isUnsupported,
  onChange,
  verifyResult,
  executionResult,
  isVerifying,
  isRunning,
}: CodePanelProps) {
  const [copied, setCopied] = useState(false);

  const displayCode = (!isSource && verifyResult?.correctedCode) ? verifyResult.correctedCode : code;
  const hasIssues = verifyResult && verifyResult.issues.length > 0;
  const isVerified = verifyResult && verifyResult.issues.length === 0;

  const handleCopy = async () => {
    if (!displayCode || isUnsupported) return;
    await navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
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
          {languageLabel}
        </span>
        <div className="flex items-center gap-2">
          {isVerifying && (
            <span className="text-xs text-yellow-400 animate-pulse">Verifying...</span>
          )}
          {isRunning && (
            <span className="text-xs text-blue-400 animate-pulse">Running...</span>
          )}
          {!isSource && isVerified && (
            <CheckCircle className="w-4 h-4 text-green-400" />
          )}
          {!isSource && hasIssues && (
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          )}
          <span className={cn(
            'px-2 py-0.5 rounded text-xs font-medium',
            isSource
              ? 'bg-[#00bcd4] text-black'
              : hasIssues
                ? 'bg-yellow-500/20 text-yellow-400'
                : isVerified
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-[#3d3d3d] text-muted-foreground'
          )}>
            {isSource ? 'Source' : hasIssues ? 'Fixed' : isVerified ? 'Verified ✓' : 'Output'}
          </span>
        </div>
      </div>

      {/* Issues Banner */}
      {!isSource && hasIssues && (
        <div className="px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <div className="text-xs text-yellow-400 font-medium mb-1">Issues found & fixed:</div>
          <ul className="text-xs text-yellow-300/80 space-y-0.5">
            {verifyResult.issues.map((issue, i) => (
              <li key={i} className="flex gap-1">
                <span>•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Code Area */}
      <div className="flex-1 overflow-hidden">
        {isUnsupported ? (
          <div className="h-full flex items-center justify-center text-muted-foreground p-4 text-center">
            {code.replace('// ', '')}
          </div>
        ) : (
          <CodeEditor
            value={displayCode}
            onChange={isSource ? onChange : undefined}
            language={language}
            readOnly={!isSource}
            placeholder={isSource ? "Enter your code here..." : ""}
            className="h-full"
          />
        )}
      </div>

      {/* Execution Output */}
      {executionResult && (
        <div className="border-t border-[#3d3d3d]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252525] border-b border-[#3d3d3d]">
            <Terminal className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Output</span>
            {executionResult.exitCode === 0 && (
              <span className="ml-auto text-xs text-green-400">Exit: 0</span>
            )}
            {executionResult.exitCode !== 0 && executionResult.exitCode !== -1 && (
              <span className="ml-auto text-xs text-red-400">Exit: {executionResult.exitCode}</span>
            )}
          </div>
          <pre className={cn(
            "px-3 py-2 text-xs font-mono max-h-[150px] overflow-auto scrollbar-thin whitespace-pre-wrap break-words",
            executionResult.error && !executionResult.output ? "text-red-400" : "text-green-400"
          )}>
            {executionResult.output || executionResult.error || 'No output'}
            {executionResult.output && executionResult.error && (
              <span className="text-red-400">{'\n' + executionResult.error}</span>
            )}
          </pre>
        </div>
      )}

      {/* Copy Button */}
      <button
        onClick={handleCopy}
        disabled={!displayCode || isUnsupported}
        className={cn(
          'w-full py-2 text-sm font-medium border-t border-[#3d3d3d] transition-colors',
          !displayCode || isUnsupported
            ? 'bg-[#2d2d2d] text-muted-foreground cursor-not-allowed'
            : 'bg-[#3d3d3d] text-foreground hover:bg-[#4d4d4d]'
        )}
      >
        {copied ? 'Copied!' : 'Copy Code'}
      </button>
    </div>
  );
}
