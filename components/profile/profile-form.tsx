'use client';

import { useState } from 'react';
import { User } from '@/types/auth';
import { Lang } from '@/types/lesson';
import { getTranslation } from '@/lib/translations';
import { updateUserProfile } from '@/lib/authStorage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ProfileFormProps {
  user: User;
  lang: Lang;
  onUpdate: () => void;
}

export function ProfileForm({ user, lang, onUpdate }: ProfileFormProps) {
  const t = getTranslation(lang).profile;
  const { toast } = useToast();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const newErrors: { name?: string; email?: string } = {};

    if (!name.trim()) {
      newErrors.name = t.nameRequired;
    } else if (name.trim().length < 2) {
      newErrors.name = t.nameTooShort;
    }

    if (!email.trim()) {
      newErrors.email = t.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t.emailInvalid;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    const result = await updateUserProfile(user.id, name.trim(), email.trim());

    if (result.success) {
      toast({
        title: t.profileUpdated,
        variant: 'default',
      });
      onUpdate();
    } else {
      toast({
        title: t.updateError,
        description: result.error,
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.personalInfo}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t.name}</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t.email}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t.createdAt}</Label>
            <p className="text-sm text-muted-foreground">
              {new Date(user.createdAt).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {t.updateProfile}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
