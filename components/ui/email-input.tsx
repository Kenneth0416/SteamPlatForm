'use client';

import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const COMMON_DOMAINS = [
  '@gmail.com',
  '@outlook.com',
  '@hotmail.com',
  '@yahoo.com',
  '@icloud.com',
  '@qq.com',
  '@163.com',
  '@126.com',
];

interface EmailInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export function EmailInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  className,
  ...ariaProps
}: EmailInputProps) {
  const [suggestion, setSuggestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const updateSuggestion = (inputValue: string) => {
    if (!inputValue) {
      setSuggestion('');
      return;
    }

    const atIndex = inputValue.indexOf('@');

    // 情況 1: 沒有 @，建議第一個域名
    if (atIndex === -1) {
      setSuggestion(COMMON_DOMAINS[0]);
      return;
    }

    // 情況 2: 有 @，根據 @ 後的內容匹配域名
    const afterAt = inputValue.slice(atIndex + 1).toLowerCase();

    // 如果 @ 後面已經有完整域名，不顯示建議
    if (COMMON_DOMAINS.some(domain => domain.slice(1) === afterAt)) {
      setSuggestion('');
      return;
    }

    // 找到匹配的域名（去掉 @ 符號後匹配）
    const match = COMMON_DOMAINS.find(domain =>
      domain.slice(1).toLowerCase().startsWith(afterAt)
    );

    if (match) {
      // 只顯示未輸入的部分
      setSuggestion(match.slice(1 + afterAt.length));
    } else {
      setSuggestion('');
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    updateSuggestion(newValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      onChange(value + suggestion);
      setSuggestion('');
    }
  };

  const handleBlur = () => {
    setSuggestion('');
    onBlur?.();
  };

  return (
    <div className="relative">
      {/* 補全建議層 */}
      {suggestion && (
        <div className="absolute inset-0 pointer-events-none flex items-center pl-10">
          <span className="select-none">
            <span className="invisible">{value}</span>
            <span className="text-muted-foreground/40">{suggestion}</span>
          </span>
        </div>
      )}

      {/* 實際輸入框 */}
      <Input
        ref={inputRef}
        id={id}
        type="email"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn('relative bg-transparent', className)}
        autoComplete="off"
        {...ariaProps}
      />

      {/* Tab 提示 */}
      {suggestion && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
          Tab
        </div>
      )}
    </div>
  );
}
