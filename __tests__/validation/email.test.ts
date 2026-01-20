import { validateEmail } from '@/lib/validation/email';

describe('validateEmail', () => {
  describe('有效郵箱', () => {
    it('應接受標準郵箱格式', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user@example.com')).toBe(true);
      expect(validateEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('應接受帶數字的郵箱', () => {
      expect(validateEmail('user123@example.com')).toBe(true);
      expect(validateEmail('123user@example.com')).toBe(true);
    });

    it('應接受特殊字符', () => {
      expect(validateEmail('user.name+tag@example.com')).toBe(true);
      expect(validateEmail('user_name@example.com')).toBe(true);
      expect(validateEmail('user-name@example.com')).toBe(true);
    });

    it('應接受子域名', () => {
      expect(validateEmail('user@mail.example.com')).toBe(true);
      expect(validateEmail('user@sub.mail.example.com')).toBe(true);
    });
  });

  describe('無效郵箱', () => {
    it('應拒絕缺少 @ 符號', () => {
      expect(validateEmail('userexample.com')).toBe(false);
      expect(validateEmail('user.example.com')).toBe(false);
    });

    it('應拒絕過於簡單的格式', () => {
      expect(validateEmail('a@b')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });

    it('應拒絕多個 @ 符號', () => {
      expect(validateEmail('user@@example.com')).toBe(false);
      expect(validateEmail('user@domain@example.com')).toBe(false);
    });

    it('應拒絕空值和非字符串', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('   ')).toBe(false);
    });

    it('應拒絕無效域名', () => {
      expect(validateEmail('user@.com')).toBe(false);
      expect(validateEmail('user@domain.')).toBe(false);
      expect(validateEmail('user@-domain.com')).toBe(false);
    });

    it('應拒絕帶空格的郵箱', () => {
      expect(validateEmail('user @example.com')).toBe(false);
      expect(validateEmail('user@ example.com')).toBe(false);
    });
  });

  describe('邊界情況', () => {
    it('應處理前後空格', () => {
      expect(validateEmail(' user@example.com ')).toBe(true);
      expect(validateEmail('\tuser@example.com\n')).toBe(true);
    });

    it('應拒絕超長域名標籤（>63 字符）', () => {
      const longLabel = 'a'.repeat(64);
      expect(validateEmail(`user@${longLabel}.com`)).toBe(false);
    });

    it('應接受最大長度域名標籤（63 字符）', () => {
      const maxLabel = 'a'.repeat(63);
      expect(validateEmail(`user@${maxLabel}.com`)).toBe(true);
    });
  });
});
