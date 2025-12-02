import { cn } from '@/lib/utils';
import type { Language } from '@/lib/transpiler';

interface LanguageSelectorProps {
  value: Language;
  onChange: (value: Language) => void;
  disabled?: boolean;
}

const languages: { value: Language; label: string; icon: string }[] = [
  { value: 'python', label: 'Python', icon: '🐍' },
  { value: 'c', label: 'C', icon: '⚙️' },
  { value: 'cpp', label: 'C++', icon: '⚡' },
  { value: 'java', label: 'Java', icon: '☕' },
];

export function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {languages.map((lang) => (
        <button
          key={lang.value}
          onClick={() => onChange(lang.value)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200',
            value === lang.value
              ? 'bg-primary text-primary-foreground shadow-lg glow-primary'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span>{lang.icon}</span>
          <span>{lang.label}</span>
        </button>
      ))}
    </div>
  );
}
