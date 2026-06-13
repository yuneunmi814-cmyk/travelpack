export type Transport = 'WALK' | 'BUS' | 'TAXI' | 'CAR'
export type TripStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELED'
export type VisitStatus = 'PENDING' | 'DONE' | 'SKIPPED'

export interface Region { id: string; name: string; slug: string; thumbnailUrl?: string | null; courseCount?: number; visitorScore?: number; trending?: boolean }
export interface Theme { id: string; name: string; icon?: string | null }

export interface CourseCard {
  id: string
  title: string
  summary: string | null
  cover: string | null
  region: string
  durationDays: number
  spotCount: number
  estCost: number | null
  themes: string[]
  saveCount: number
}

export interface Banner { id: string; title: string; imageUrl: string; linkType: string; linkTarget: string | null }

export interface HomeFeed {
  banners: Banner[]
  recommendedCourses: CourseCard[]
  popularRegions: Region[]
  themeSections: { theme: { id: string; name: string }; courses: CourseCard[] }[]
}

export interface SpotSummary {
  id: string
  name: string
  category: string
  summary?: string | null
  lat?: number       // 유료 코스 잠금 미리보기에서는 비어 있음
  lng?: number
  thumbnail: string | null
}

export type ContentStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED'
export type EntitlementReason = 'FREE' | 'AUTHOR' | 'PURCHASED' | 'LOCKED'
export type CourseAuthorType = 'EDITOR' | 'USER'

export interface CourseItem {
  id: string
  order: number
  stayMinutes: number | null
  transportToNext: Transport | null
  transportMinutes: number | null
  note: string | null
  spot: SpotSummary
}

export interface CourseDay { dayNo: number; items: CourseItem[] }

export interface CourseDetail {
  id: string
  title: string
  summary: string | null
  cover: string | null
  region: { id: string; name: string }
  authorType: CourseAuthorType
  author: { id: string; nickname: string } | null
  price: number
  durationDays: number
  estCost: number | null
  themes: { id: string; name: string }[]
  spotCount: number
  saveCount: number
  locked: boolean
  entitlementReason: EntitlementReason
  days: CourseDay[]
  reviewSummary: { avg: number | null; count: number }
  isBookmarked: boolean | null
}

// 마켓플레이스 카드(사용자 작성 코스)
export interface MarketCard {
  id: string
  title: string
  summary: string | null
  cover: string | null
  region: string
  durationDays: number
  spotCount: number
  price: number
  salesCount: number
  saveCount: number
  themes: string[]
  author: { id: string; nickname: string } | null
}

// 내 코스(크리에이터) 목록 항목
export interface MyCourse {
  id: string
  title: string
  cover: string | null
  region: string
  status: ContentStatus
  durationDays: number
  spotCount: number
  price: number
  salesCount: number
  publishedAt: string | null
}

// 내 코스 상세(에디터 프리필용)
export interface MyCourseDetail {
  id: string
  title: string
  summary: string | null
  cover: string | null
  region: { id: string; name: string }
  durationDays: number
  estCost: number | null
  price: number
  status: ContentStatus
  salesCount: number
  publishedAt: string | null
  themes: { id: string; name: string }[]
  spotCount: number
  days: CourseDay[]
  editable: boolean
}

export interface Purchase { purchaseId: string; price: number; purchasedAt: string | null; course: MarketCard }

// 스팟 선택기용 경량 항목
export interface SpotPick { id: string; name: string; category: string; lat: number; lng: number; thumbnail: string | null }

export interface AudioGuide {
  id: string
  title: string
  audioTitle: string | null
  script: string | null
  audioUrl: string | null
  playTime: number | null
  langCode: string
  source: string
}

export interface SpotDetail {
  id: string
  name: string
  category: string
  region: { id: string; name: string }
  summary: string | null
  description: string | null
  tips: string | null
  address: string | null
  lat: number
  lng: number
  phone: string | null
  todayOpen: boolean | null
  todayHours: string | null
  admissionFee: string | null
  avgStayMinutes: number | null
  images: { url: string; credit: string | null }[]
  reviewSummary: { avg: number | null; count: number }
  nearbySpots: { id: string; name: string; category: string; distanceM: number }[]
  isBookmarked: boolean | null
  audioGuides: AudioGuide[]
}

export interface TripVisit {
  id: string
  status: VisitStatus
  checkedInAt: string | null
  checkinType: 'VERIFIED' | 'MANUAL' | null
  dayNo: number
  order: number
  stayMinutes: number | null
  transportToNext: Transport | null
  transportMinutes: number | null
  spot: { id: string; name: string; category: string; lat: number; lng: number }
}

export interface Trip {
  id: string
  status: TripStatus
  startDate: string
  endDate: string
  course: { id: string; title: string; cover: string | null; region: string; durationDays: number }
  progress: { done: number; skipped: number; total: number }
  visits: TripVisit[]
  nextVisit?: TripVisit | null
}

export interface CheckInResult {
  visit: TripVisit
  progress: { done: number; skipped: number; total: number }
  nextVisit: TripVisit | null
  tripStatus: TripStatus
}

export interface Me { id: string; email: string | null; nickname: string; profileImageUrl: string | null; interests: Theme[] }

export interface Paged<T> { items: T[]; nextCursor: string | null }
