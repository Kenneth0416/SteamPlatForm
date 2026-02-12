'use client';

import { Lang, SavedLesson } from '@/types/lesson';
import { getTranslation } from '@/lib/translations';
import { Star, Edit, Copy, Archive, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhTW, enUS } from 'date-fns/locale';

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
  const locale = lang === 'zh' ? zhTW : enUS;

  const timeAgo = formatDistanceToNow(new Date(lesson.updatedAt), {
    addSuffix: true,
    locale,
  });

  const domainColorMap: Record<string, string> = {
    S: 'bg-blue-500',
    T: 'bg-green-500',
    E: 'bg-orange-500',
    A: 'bg-pink-400',
    M: 'bg-purple-300',
  };

  return (
    <div className={`group relative rounded-2xl bg-gradient-to-br from-purple-500 via-purple-400 to-pink-400 p-5 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-2xl ${lesson.isArchived ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-lg font-bold line-clamp-2">{lesson.title}</h3>
        <button
          className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          onClick={() => onToggleFavorite(lesson.id)}
        >
          <Star className={`h-5 w-5 ${lesson.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-white/80'}`} />
        </button>
      </div>
      <p className="text-sm text-white/80 mb-3">
        {t.gradeLevels[lesson.requirements.gradeLevel as keyof typeof t.gradeLevels]} · {lesson.requirements.numberOfSessions}{' '}
        {t.library.sessions} · {lesson.requirements.durationPerSession} {t.library.minutes}
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {lesson.requirements.steamDomains.map((domain: string) => (
          <span key={domain} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${domainColorMap[domain] || 'bg-purple-300'}`}>
            {t.domains[domain as keyof typeof t.domains]}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {lesson.tags?.slice(0, 4).map((tag, idx) => (
          <span key={idx} className="text-xs text-white/70">
            #{tag}
          </span>
        ))}
      </div>
      <div className="text-xs text-white/60 mb-4">
        {t.library.updatedAt}: {timeAgo}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="inline-flex items-center rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition-colors" onClick={() => onEdit(lesson.id)}>
          <Edit className="h-3 w-3 mr-1" />
          {t.library.edit}
        </button>
        <button className="inline-flex items-center rounded-lg border border-white/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors" onClick={() => onDuplicate(lesson.id)}>
          <Copy className="h-3 w-3 mr-1" />
          {t.library.duplicate}
        </button>
        {lesson.isArchived ? (
          <button className="inline-flex items-center rounded-lg border border-white/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors" onClick={() => onArchive(lesson.id, false)}>
            <Archive className="h-3 w-3 mr-1" />
            {t.library.unarchive}
          </button>
        ) : (
          <button className="inline-flex items-center rounded-lg border border-white/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors" onClick={() => onArchive(lesson.id, true)}>
            <Archive className="h-3 w-3 mr-1" />
            {t.library.archive}
          </button>
        )}
        <button className="inline-flex items-center rounded-lg border border-white/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors" onClick={() => onDelete(lesson.id)}>
          <Trash2 className="h-3 w-3 mr-1" />
          {t.library.delete}
        </button>
      </div>
    </div>
  );
}
