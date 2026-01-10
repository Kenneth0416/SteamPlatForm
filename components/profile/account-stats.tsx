'use client';

import { Lang } from '@/types/lesson';
import { getTranslation } from '@/lib/translations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AccountStatsProps {
  totalLessons: number;
  accountAge: number;
  lang: Lang;
}

export function AccountStats({ totalLessons, accountAge, lang }: AccountStatsProps) {
  const t = getTranslation(lang).profile;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.accountStats}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{t.totalLessons}</span>
          <span className="text-2xl font-bold text-primary">{totalLessons}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{t.accountAge}</span>
          <span className="text-2xl font-bold text-primary">
            {accountAge} {t.days}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
