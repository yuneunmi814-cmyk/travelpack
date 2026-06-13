import { prisma } from '../../lib/prisma.js'

export type EntitlementReason = 'FREE' | 'AUTHOR' | 'PURCHASED' | 'LOCKED'
export interface Entitlement {
  entitled: boolean
  reason: EntitlementReason
}

/**
 * 코스 전체 콘텐츠 접근 권한(이용권) 판정.
 * - 무료(price<=0): 누구나 접근
 * - 작성자 본인: 접근
 * - 결제 완료(PAID) 구매자: 접근
 * - 그 외 유료 코스: LOCKED(미리보기만)
 */
export async function courseEntitlement(
  course: { id: bigint; price: number; authorUserId: bigint | null },
  userId: bigint | null,
): Promise<Entitlement> {
  if (course.price <= 0) return { entitled: true, reason: 'FREE' }
  if (userId && course.authorUserId && course.authorUserId === userId) return { entitled: true, reason: 'AUTHOR' }
  if (userId) {
    const purchase = await prisma.coursePurchase.findUnique({
      where: { courseId_userId: { courseId: course.id, userId } },
      select: { status: true },
    })
    if (purchase?.status === 'PAID') return { entitled: true, reason: 'PURCHASED' }
  }
  return { entitled: false, reason: 'LOCKED' }
}
