'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import { setCurrentUser } from '@/lib/authStorage';
import Link from 'next/link';
import { Lang } from '@/types/lesson';
import { getTranslation } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, AlertCircle } from 'lucide-react';

interface LoginFormProps {
  lang: Lang;
}

export function LoginForm({ lang }: LoginFormProps) {
  const t = getTranslation(lang);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t.auth.requiredField);
      return;
    }

    if (!email.includes('@')) {
      setError(t.auth.invalidEmail);
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t.auth.loginError);
      } else {
        // Sync NextAuth session to localStorage for lib/api.ts compatibility
        const session = await getSession();
        if (session?.user) {
          setCurrentUser({
            id: session.user.id,
            name: session.user.name || '',
            email: session.user.email || '',
            role: (session.user.role as 'user' | 'admin') || 'user',
            createdAt: new Date(),
          });
        }
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError(t.auth.loginError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          {t.auth.login}
        </CardTitle>
        <CardDescription className="text-center">
          {t.auth.emailPlaceholder}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t.auth.email}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder={t.auth.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t.auth.password}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder={t.auth.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? '...' : t.auth.loginButton}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <div className="text-sm text-center text-muted-foreground">
          {t.auth.noAccount}{' '}
          <Link href="/auth/register" className="text-primary hover:underline font-medium">
            {t.auth.signUp}
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
