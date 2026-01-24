'use client';

import { Lang, SavedLesson } from '@/types/lesson';
import { getTranslation } from '@/lib/translations';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Edit, Copy, Archive, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';

interface LessonCardProps {
  lesson: SavedLesson;
  lang: Lang;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function LessonCard({
  lesson,
  lang,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  onToggleFavorite,
}: LessonCardProps) {
  const t = getTranslation(lang);
  const locale = lang === 'zh' ? zhCN : enUS;

  const timeAgo = formatDistanceToNow(new Date(lesson.updatedAt), {
    addSuffix: true,
    locale,
  });

  return (
    <Card className={`group hover:shadow-md transition-shadow ${lesson.isArchived ? 'opacity-60' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">{lesson.title}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onToggleFavorite(lesson.id)}
          >
            <Star className={`h-4 w-4 ${lesson.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          {t.gradeLevels[lesson.requirements.gradeLevel as keyof typeof t.gradeLevels]} • {lesson.requirements.numberOfSessions}{' '}
          {t.library.sessions} × {lesson.requirements.durationPerSession} {t.library.minutes}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {lesson.requirements.steamDomains.map((domain: string) => (
            <Badge key={domain} variant="secondary">
              {t.domains[domain as keyof typeof t.domains]}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 mb-4">
          {lesson.tags?.slice(0, 4).map((tag, idx) => (
            <span key={idx} className="text-xs text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mb-4">
          {t.library.updatedAt}: {timeAgo}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={() => onEdit(lesson.id)}>
            <Edit className="h-3 w-3 mr-1" />
            {t.library.edit}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDuplicate(lesson.id)}>
            <Copy className="h-3 w-3 mr-1" />
            {t.library.duplicate}
          </Button>
          {lesson.isArchived ? (
            <Button variant="outline" size="sm" onClick={() => onArchive(lesson.id, false)}>
              <Archive className="h-3 w-3 mr-1" />
              {t.library.unarchive}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onArchive(lesson.id, true)}>
              <Archive className="h-3 w-3 mr-1" />
              {t.library.archive}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onDelete(lesson.id)}>
            <Trash2 className="h-3 w-3 mr-1" />
            {t.library.delete}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
