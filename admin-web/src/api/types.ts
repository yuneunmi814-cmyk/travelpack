export type AdminRole =
  | 'SUPER_ADMIN'
  | 'CONTENT_MANAGER'
  | 'OPERATION_MANAGER'
  | 'MARKETER'
  | 'READ_ONLY'

export type ContentStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED'
export type SpotStatus = 'ACTIVE' | 'INACTIVE'
export type Transport = 'WALK' | 'BUS' | 'TAXI' | 'CAR'

export interface Region { id: string; name: string; slug: string }
export interface Theme { id: string; name: string; icon?: string | null }

export interface DashboardStats {
  from: string
  to: string
  signups: number
  tripStarts: number
  checkIns: number
  activeUsers: number
  topCourses: { id: string; title: string; saveCount: number; viewCount: number }[]
}

export interface SpotListItem {
  id: string
  name: string
  category: string
  region: string
  status: SpotStatus
  source: string
  usedInCourses: number
  checkinRadiusM: number | null
}

export interface SpotDetail {
  id: string
  regionId: string
  name: string
  category: string
  summary: string | null
  description: string | null
  tips: string | null
  address: string | null
  lat: number
  lng: number
  openHours: unknown
  admissionFee: string | null
  avgStayMinutes: number | null
  phone: string | null
  status: SpotStatus
  checkinRadiusM: number | null
  source: string
  images: { id: string; url: string; sourceCredit: string | null; sortOrder: number }[]
  region: { id: string; name: string }
}

export interface CourseListItem {
  id: string
  title: string
  region: string
  status: ContentStatus
  durationDays: number
  spotCount: number
  createdBy: string
  authorType?: 'EDITOR' | 'USER'
  price?: number
  salesCount?: number
  publishedAt: string | null
  saveCount: number
}

export interface CourseItem {
  id: string
  dayNo: number
  sortOrder: number
  spotId: string
  stayMinutes: number | null
  transportToNext: Transport | null
  transportMinutes: number | null
  note: string | null
  spot: { id: string; name: string }
}

export interface CourseDetail {
  id: string
  regionId: string
  title: string
  summary: string | null
  durationDays: number
  estCost: number | null
  coverImageUrl: string | null
  status: ContentStatus
  createdBy: string
  themes: { theme: Theme }[]
  items: CourseItem[]
  creator: { id: string; name: string }
}

export interface AdminUserRow {
  id: string
  email: string | null
  nickname: string
  provider: string
  status: 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN'
  createdAt: string
  lastLoginAt: string | null
}

export interface ReportRow {
  id: string
  reasonCode: string
  detail: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  createdAt: string
  reporter: { id: string; nickname: string }
  review: { id: string; content: string; status: string; author: { id: string; nickname: string } }
}

export interface BannerRow {
  id: string
  title: string
  imageUrl: string
  linkType: string
  linkTarget: string | null
  startAt: string
  endAt: string
  sortOrder: number
  isActive: boolean
}

export interface Paged<T> {
  items: T[]
  nextCursor: string | null
}
