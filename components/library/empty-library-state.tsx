'use client';

import { Lang } from '@/types/lesson';
import { getTranslation } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import Link from 'next/link';

interface EmptyLibraryStateProps {
  lang: Lang;
}

export function EmptyLibraryState({ lang }: EmptyLibraryStateProps) {
  const t = getTranslation(lang);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-2xl font-semibold mb-2">{t.library.emptyStateTitle}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        {t.library.emptyStateDescription}
      </p>
      <Button asChild>
        <Link href="/">{t.library.createNew}</Link>
      </Button>
    </div>
  );
}
