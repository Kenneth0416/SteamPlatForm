'use client';

import { Lang, GradeLevel, STEAMDomain } from '@/types/lesson';
import { getTranslation } from '@/lib/translations';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface LessonFiltersProps {
  lang: Lang;
  selectedGrades: GradeLevel[];
  selectedDomains: STEAMDomain[];
  showArchived: boolean;
  showFavoritesOnly: boolean;
  onGradeChange: (grade: GradeLevel, checked: boolean) => void;
  onDomainChange: (domain: STEAMDomain, checked: boolean) => void;
  onShowArchivedChange: (checked: boolean) => void;
  onShowFavoritesChange: (checked: boolean) => void;
  onClearFilters: () => void;
}

export function LessonFilters({
  lang,
  selectedGrades,
  selectedDomains,
  showArchived,
  showFavoritesOnly,
  onGradeChange,
  onDomainChange,
  onShowArchivedChange,
  onShowFavoritesChange,
  onClearFilters,
}: LessonFiltersProps) {
  const t = getTranslation(lang);

  const grades: GradeLevel[] = ['p1-3', 'p4-6', 's1-3', 's4-6'];
  const domains: STEAMDomain[] = ['S', 'T', 'E', 'A', 'M'];

  const hasActiveFilters =
    selectedGrades.length > 0 || selectedDomains.length > 0 || showArchived || showFavoritesOnly;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">{t.library.filters}</CardTitle>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="h-4 w-4 mr-1" />
            {t.library.clearFilters}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-sm font-semibold mb-3 block">{t.library.filterByGrade}</Label>
          <div className="space-y-2">
            {grades.map((grade) => (
              <div key={grade} className="flex items-center space-x-2">
                <Checkbox
                  id={`grade-${grade}`}
                  checked={selectedGrades.includes(grade)}
                  onCheckedChange={(checked) => onGradeChange(grade, checked as boolean)}
                />
                <Label
                  htmlFor={`grade-${grade}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {t.gradeLevels[grade]}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold mb-3 block">{t.library.filterByDomain}</Label>
          <div className="space-y-2">
            {domains.map((domain) => (
              <div key={domain} className="flex items-center space-x-2">
                <Checkbox
                  id={`domain-${domain}`}
                  checked={selectedDomains.includes(domain)}
                  onCheckedChange={(checked) => onDomainChange(domain, checked as boolean)}
                />
                <Label
                  htmlFor={`domain-${domain}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {t.domains[domain]}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-favorites"
                checked={showFavoritesOnly}
                onCheckedChange={(checked) => onShowFavoritesChange(checked as boolean)}
              />
              <Label htmlFor="show-favorites" className="text-sm font-normal cursor-pointer">
                {t.library.showFavorites}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-archived"
                checked={showArchived}
                onCheckedChange={(checked) => onShowArchivedChange(checked as boolean)}
              />
              <Label htmlFor="show-archived" className="text-sm font-normal cursor-pointer">
                {t.library.showArchived}
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
