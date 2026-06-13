// 가격 표기: 0원은 "무료", 그 외 천단위 콤마 + 원
export function priceLabel(won: number): string {
  if (!won || won <= 0) return '무료'
  return `${won.toLocaleString('ko-KR')}원`
}

export function durationLabel(days: number): string {
  return days > 1 ? `${days - 1}박${days}일` : '당일'
}
