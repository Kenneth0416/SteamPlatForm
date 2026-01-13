'use client';

import { useState } from 'react';
import { Lang } from '@/types/lesson';
import { LoginForm } from '@/components/auth/login-form';
import { LanguageToggle } from '@/components/steam-agent/language-toggle';

export default function LoginPage() {
  const [currentLang, setCurrentLang] = useState<Lang>('en');

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <LanguageToggle currentLang={currentLang} onToggle={setCurrentLang} />
      </div>
      <LoginForm lang={currentLang} />
    </div>
  );
}
