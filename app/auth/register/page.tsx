'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lang } from '@/types/lesson';
import { isAuthenticated } from '@/lib/authStorage';
import { RegisterForm } from '@/components/auth/register-form';
import { LanguageToggle } from '@/components/steam-agent/language-toggle';

export default function RegisterPage() {
  const [currentLang, setCurrentLang] = useState<Lang>('en');
  const router = useRouter();

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated()) {
      router.push('/');
    }
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <LanguageToggle currentLang={currentLang} onToggle={setCurrentLang} />
      </div>
      <RegisterForm lang={currentLang} />
    </div>
  );
}
