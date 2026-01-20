import { render, screen, fireEvent } from '@testing-library/react';
import { EmailInput } from '@/components/ui/email-input';
import { useState } from 'react';

// 測試包裝器組件
function TestWrapper() {
  const [value, setValue] = useState('');
  return <EmailInput value={value} onChange={setValue} />;
}

describe('EmailInput', () => {
  it('應渲染輸入框', () => {
    const onChange = jest.fn();
    render(<EmailInput value="" onChange={onChange} />);

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('應在輸入用戶名時顯示域名建議', () => {
    const { container } = render(<TestWrapper />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'user' } });

    // 檢查是否顯示補全建議（只顯示域名部分）
    const suggestion = container.querySelector('.text-muted-foreground\\/40');
    expect(suggestion).toBeInTheDocument();
    expect(suggestion?.textContent).toBe('@gmail.com');
  });

  it('應在輸入 @ 後根據字符匹配域名', () => {
    const { container } = render(<TestWrapper />);

    const input = screen.getByRole('textbox');

    // 輸入 @g 應該匹配 gmail
    fireEvent.change(input, { target: { value: 'user@g' } });
    let suggestion = container.querySelector('.text-muted-foreground\\/40');
    expect(suggestion?.textContent).toBe('mail.com');

    // 輸入 @1 應該匹配 163
    fireEvent.change(input, { target: { value: 'user@1' } });
    suggestion = container.querySelector('.text-muted-foreground\\/40');
    expect(suggestion?.textContent).toBe('63.com');
  });

  it('應在按 Tab 時補全郵箱', () => {
    const { container } = render(<TestWrapper />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    // 輸入用戶名
    fireEvent.change(input, { target: { value: 'user' } });

    // 模擬按 Tab 鍵
    fireEvent.keyDown(input, { key: 'Tab' });

    // 應該補全郵箱
    expect(input.value).toBe('user@gmail.com');
  });

  it('應在輸入完整域名時不顯示建議', () => {
    const { container } = render(<TestWrapper />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'user@gmail.com' } });

    const suggestion = container.querySelector('.text-muted-foreground\\/40');
    expect(suggestion).not.toBeInTheDocument();
  });

  it('應顯示 Tab 提示文字', () => {
    render(<TestWrapper />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'user' } });

    // 檢查是否有 "Tab" 提示
    expect(screen.getByText('Tab')).toBeInTheDocument();
  });

  it('應支持禁用狀態', () => {
    const onChange = jest.fn();
    render(<EmailInput value="" onChange={onChange} disabled />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('應支持自定義 className', () => {
    const onChange = jest.fn();
    render(<EmailInput value="" onChange={onChange} className="custom-class" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-class');
  });
});
