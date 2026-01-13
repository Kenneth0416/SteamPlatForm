'use client';

import { useState } from 'react';
import { Lang } from '@/types/lesson';
import { RegisterForm } from '@/components/auth/register-form';
import { LanguageToggle } from '@/components/steam-agent/language-toggle';

export default function RegisterPage() {
  const [currentLang, setCurrentLang] = useState<Lang>('en');

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <LanguageToggle currentLang={currentLang} onToggle={setCurrentLang} />
      </div>
      <RegisterForm lang={currentLang} />
    </div>
  );
}
