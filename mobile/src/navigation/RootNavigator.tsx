import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme'
import type { ExploreStackParams, MyStackParams, TabParams, TripsStackParams } from './types'
import { HomeScreen } from '../screens/HomeScreen'
import { RegionsScreen } from '../screens/RegionsScreen'
import { CourseListScreen } from '../screens/CourseListScreen'
import { CourseDetailScreen } from '../screens/CourseDetailScreen'
import { SpotDetailScreen } from '../screens/SpotDetailScreen'
import { ReviewWriteScreen } from '../screens/ReviewWriteScreen'
import { TripsScreen } from '../screens/TripsScreen'
import { GuideModeScreen } from '../screens/GuideModeScreen'
import { SavedScreen } from '../screens/SavedScreen'
import { MyScreen } from '../screens/MyScreen'
import { LoginScreen } from '../screens/LoginScreen'
import { ConsentScreen } from '../screens/ConsentScreen'
import { InterestsScreen } from '../screens/InterestsScreen'
import { MarketplaceScreen } from '../screens/MarketplaceScreen'
import { MyCoursesScreen } from '../screens/MyCoursesScreen'
import { CourseEditorScreen } from '../screens/CourseEditorScreen'
import { MyPurchasesScreen } from '../screens/MyPurchasesScreen'

const Tab = createBottomTabNavigator<TabParams>()
const ExploreStack = createNativeStackNavigator<ExploreStackParams>()
const TripsStack = createNativeStackNavigator<TripsStackParams>()
const MyStack = createNativeStackNavigator<MyStackParams>()

function ExploreNavigator() {
  return (
    <ExploreStack.Navigator>
      <ExploreStack.Screen name="Regions" component={RegionsScreen} options={{ title: '탐색' }} />
      <ExploreStack.Screen name="CourseList" component={CourseListScreen} options={{ title: '코스' }} />
      <ExploreStack.Screen name="CourseDetail" component={CourseDetailScreen} options={{ title: '코스 상세' }} />
      <ExploreStack.Screen name="SpotDetail" component={SpotDetailScreen} options={{ title: '관광지' }} />
      <ExploreStack.Screen name="ReviewWrite" component={ReviewWriteScreen} options={{ title: '리뷰 작성' }} />
      <ExploreStack.Screen name="Marketplace" component={MarketplaceScreen} options={{ title: '크리에이터 마켓' }} />
    </ExploreStack.Navigator>
  )
}

function TripsNavigator() {
  return (
    <TripsStack.Navigator>
      <TripsStack.Screen name="MyTrips" component={TripsScreen} options={{ title: '내 여행' }} />
      <TripsStack.Screen name="GuideMode" component={GuideModeScreen} options={{ title: '가이드 모드' }} />
    </TripsStack.Navigator>
  )
}

function MyNavigator() {
  return (
    <MyStack.Navigator>
      <MyStack.Screen name="MyPage" component={MyScreen} options={{ title: 'MY' }} />
      <MyStack.Screen name="Login" component={LoginScreen} options={{ title: '로그인', presentation: 'modal' }} />
      <MyStack.Screen name="Consent" component={ConsentScreen} options={{ title: '약관 동의' }} />
      <MyStack.Screen name="Interests" component={InterestsScreen} options={{ title: '관심 테마' }} />
      <MyStack.Screen name="MyCourses" component={MyCoursesScreen} options={{ title: '내 여행팩' }} />
      <MyStack.Screen name="CourseEditor" component={CourseEditorScreen} options={{ title: '여행팩 만들기' }} />
      <MyStack.Screen name="MyPurchases" component={MyPurchasesScreen} options={{ title: '구매한 여행팩' }} />
    </MyStack.Navigator>
  )
}

const ICONS: Record<keyof TabParams, keyof typeof Ionicons.glyphMap> = {
  HomeTab: 'home-outline',
  ExploreTab: 'compass-outline',
  TripsTab: 'location-outline',
  SavedTab: 'bookmark-outline',
  MyTab: 'person-outline',
}

export function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textHint,
        tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name]} size={size} color={color} />,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: '홈', headerShown: true }} />
      <Tab.Screen name="ExploreTab" component={ExploreNavigator} options={{ title: '탐색' }} />
      <Tab.Screen name="TripsTab" component={TripsNavigator} options={{ title: '내 여행' }} />
      <Tab.Screen name="SavedTab" component={SavedScreen} options={{ title: '저장', headerShown: true }} />
      <Tab.Screen name="MyTab" component={MyNavigator} options={{ title: 'MY' }} />
    </Tab.Navigator>
  )
}
