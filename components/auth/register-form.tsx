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
import { EmailInput } from '@/components/ui/email-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';
import { validateEmail } from '@/lib/validation/email';

interface RegisterFormProps {
  lang: Lang;
}

export function RegisterForm({ lang }: RegisterFormProps) {
  const t = getTranslation(lang);
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      setError(t.auth.requiredField);
      return;
    }

    if (!validateEmail(email)) {
      setError(t.auth.invalidEmail);
      return;
    }
    
    if (password.length < 8) {
      setError(t.auth.passwordTooShort);
      return;
    }
    
    if (password !== confirmPassword) {
      setError(t.auth.passwordMismatch);
      return;
    }
    
    if (!agreeTerms) {
      setError(t.auth.mustAgreeTerms);
      return;
    }
    
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t.auth.registerError);
        return;
      }

      // Auto login after registration
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        router.push('/auth/login');
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
      setError(t.auth.registerError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          {t.auth.register}
        </CardTitle>
        <CardDescription className="text-center">
          {t.auth.registerButton}
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
            <Label htmlFor="name">{t.auth.name}</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder={t.auth.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">{t.auth.email}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
              <EmailInput
                id="email"
                value={email}
                onChange={setEmail}
                placeholder={t.auth.emailPlaceholder}
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
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t.auth.confirmPasswordPlaceholder}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={agreeTerms}
              onCheckedChange={(checked) => setAgreeTerms(checked as boolean)}
              disabled={isLoading}
            />
            <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
              {t.auth.agreeTerms}
            </Label>
          </div>
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? '...' : t.auth.registerButton}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <div className="text-sm text-center text-muted-foreground">
          {t.auth.hasAccount}{' '}
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            {t.auth.signIn}
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
