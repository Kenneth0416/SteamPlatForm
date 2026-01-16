'use client';

import { Lang } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

interface LanguageToggleProps {
  currentLang: Lang;
  onToggle: (lang: Lang) => void;
}

export function LanguageToggle({ currentLang, onToggle }: LanguageToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <div className="flex gap-1 border rounded-md p-1">
        <Button
          variant={currentLang === 'en' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onToggle('en')}
          className="h-7 px-3 text-xs"
        >
          EN
        </Button>
        <Button
          variant={currentLang === 'zh' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onToggle('zh')}
          className="h-7 px-3 text-xs"
        >
          中文
        </Button>
      </div>
    </div>
  );
}
