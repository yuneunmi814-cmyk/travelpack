import type { NavigatorScreenParams } from '@react-navigation/native'

export type ExploreStackParams = {
  Regions: undefined
  CourseList: { regionId?: string; regionName?: string }
  CourseDetail: { courseId: string }
  SpotDetail: { spotId: string }
  ReviewWrite: { targetType: 'COURSE' | 'SPOT'; targetId: string; targetName: string }
  Marketplace: undefined
}

export type TripsStackParams = {
  MyTrips: undefined
  GuideMode: { tripId: string }
}

export type MyStackParams = {
  MyPage: undefined
  Login: undefined
  Consent: { email: string; password: string; nickname: string }
  Interests: undefined
  MyCourses: undefined
  CourseEditor: { courseId?: string }
  MyPurchases: undefined
}

export type TabParams = {
  HomeTab: undefined
  ExploreTab: NavigatorScreenParams<ExploreStackParams>
  TripsTab: NavigatorScreenParams<TripsStackParams>
  SavedTab: undefined
  MyTab: NavigatorScreenParams<MyStackParams>
}
