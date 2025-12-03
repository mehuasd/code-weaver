import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: string;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  className,
  placeholder = 'Enter your code here...',
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = value.substring(0, start) + '    ' + value.substring(end);
      onChange?.(newValue);
      
      // Set cursor position after tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  const highlightCode = (code: string): string => {
    if (!code) return '';
    
    // Token-based highlighting to avoid nested span issues
    const tokens: { text: string; type: string }[] = [];
    let remaining = code;
    
    const keywords: Record<string, string[]> = {
      python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'in', 'and', 'or', 'not', 'True', 'False', 'None', 'self', 'print', 'input', 'range', 'len', 'int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple'],
      c: ['int', 'float', 'double', 'char', 'void', 'if', 'else', 'for', 'while', 'return', 'struct', 'typedef', 'const', 'static', 'sizeof', 'NULL', 'true', 'false', 'printf', 'scanf', 'include', 'main'],
      cpp: ['int', 'float', 'double', 'char', 'void', 'bool', 'auto', 'if', 'else', 'for', 'while', 'return', 'class', 'struct', 'public', 'private', 'protected', 'virtual', 'const', 'static', 'new', 'delete', 'nullptr', 'true', 'false', 'using', 'namespace', 'std', 'cout', 'cin', 'endl', 'string', 'include', 'iostream', 'main'],
      java: ['public', 'private', 'protected', 'static', 'final', 'abstract', 'class', 'interface', 'extends', 'implements', 'new', 'this', 'super', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'void', 'int', 'float', 'double', 'boolean', 'char', 'String', 'true', 'false', 'null', 'import', 'package', 'System', 'out', 'println', 'Scanner', 'main'],
    };
    const langKeywords = new Set(keywords[language] || []);

    while (remaining.length > 0) {
      // Check for single-line comment
      const singleComment = remaining.match(/^(\/\/.*|#.*)/);
      if (singleComment) {
        tokens.push({ text: singleComment[0], type: 'comment' });
        remaining = remaining.slice(singleComment[0].length);
        continue;
      }

      // Check for multi-line comment
      const multiComment = remaining.match(/^\/\*[\s\S]*?\*\//);
      if (multiComment) {
        tokens.push({ text: multiComment[0], type: 'comment' });
        remaining = remaining.slice(multiComment[0].length);
        continue;
      }

      // Check for strings
      const stringMatch = remaining.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
      if (stringMatch) {
        tokens.push({ text: stringMatch[0], type: 'string' });
        remaining = remaining.slice(stringMatch[0].length);
        continue;
      }

      // Check for numbers
      const numMatch = remaining.match(/^\b\d+\.?\d*[fFlL]?\b/);
      if (numMatch) {
        tokens.push({ text: numMatch[0], type: 'number' });
        remaining = remaining.slice(numMatch[0].length);
        continue;
      }

      // Check for identifiers/keywords
      const wordMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
      if (wordMatch) {
        const type = langKeywords.has(wordMatch[0]) ? 'keyword' : 'text';
        tokens.push({ text: wordMatch[0], type });
        remaining = remaining.slice(wordMatch[0].length);
        continue;
      }

      // Regular character
      tokens.push({ text: remaining[0], type: 'text' });
      remaining = remaining.slice(1);
    }

    // Build HTML from tokens
    return tokens.map(({ text, type }) => {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      if (type === 'text') return escaped;
      return `<span class="syntax-${type}">${escaped}</span>`;
    }).join('');
  };

  const lines = value.split('\n');
  const lineNumbers = lines.map((_, i) => i + 1);

  return (
    <div className={cn('code-editor relative flex h-full overflow-hidden', className)}>
      {/* Line numbers */}
      <div className="flex-shrink-0 select-none bg-code-bg border-r border-border/30 px-3 py-4 text-right font-mono text-sm text-code-line">
        {lineNumbers.map((num) => (
          <div key={num} className="leading-6">
            {num}
          </div>
        ))}
        {!value && <div className="leading-6">1</div>}
      </div>

      {/* Code area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Syntax highlighted layer */}
        <pre
          ref={highlightRef}
          className="absolute inset-0 overflow-auto p-4 font-mono text-sm leading-6 pointer-events-none scrollbar-thin"
          aria-hidden="true"
        >
          <code
            dangerouslySetInnerHTML={{ __html: highlightCode(value) || `<span class="text-muted-foreground">${placeholder}</span>` }}
          />
        </pre>

        {/* Editable textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          className={cn(
            'absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 bg-transparent text-transparent caret-primary resize-none outline-none scrollbar-thin',
            readOnly && 'cursor-default'
          )}
          placeholder=""
        />
      </div>
    </div>
  );
}
