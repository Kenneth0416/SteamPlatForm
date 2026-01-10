'use client';

import { useState } from 'react';
import { Lang } from '@/types/lesson';
import { getTranslation } from '@/lib/translations';
import { updateUserPassword, getCurrentUser } from '@/lib/authStorage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordFormProps {
  lang: Lang;
}

export function PasswordForm({ lang }: PasswordFormProps) {
  const t = getTranslation(lang).profile;
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const newErrors: { current?: string; new?: string; confirm?: string } = {};

    if (!currentPassword) {
      newErrors.current = t.currentPasswordRequired;
    }

    if (!newPassword) {
      newErrors.new = t.newPasswordRequired;
    } else if (newPassword.length < 8) {
      newErrors.new = t.newPasswordTooShort;
    } else if (newPassword === currentPassword) {
      newErrors.new = t.passwordsSame;
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirm = t.passwordsMismatch;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const user = getCurrentUser();
    if (!user) return;

    setIsSubmitting(true);
    const result = await updateUserPassword(user.id, currentPassword, newPassword);

    if (result.success) {
      toast({
        title: t.passwordUpdated,
        variant: 'default',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
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
        <CardTitle>{t.changePassword}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t.currentPassword}</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showPasswords.current ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t.currentPasswordPlaceholder}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
              >
                {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.current && <p className="text-sm text-destructive">{errors.current}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">{t.newPassword}</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPasswords.new ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.newPasswordPlaceholder}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
              >
                {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.new && <p className="text-sm text-destructive">{errors.new}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t.confirmNewPassword}</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.confirmPasswordPlaceholder}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
              >
                {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {t.updatePassword}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
