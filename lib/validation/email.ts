/**
 * 驗證郵箱格式
 * 符合 RFC 5322 標準的簡化版本
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmed = email.trim();

  // 基本格式檢查：必須包含 @ 和至少一個點
  if (!trimmed.includes('@') || !trimmed.includes('.')) {
    return false;
  }

  // RFC 5322 簡化正則：支持常見郵箱格式
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  return emailRegex.test(trimmed);
}
