import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { AdminRole } from '../api/types'

interface NavDef { to: string; label: string; roles: AdminRole[] }

const ALL: AdminRole[] = ['SUPER_ADMIN', 'CONTENT_MANAGER', 'OPERATION_MANAGER', 'MARKETER', 'READ_ONLY']
const NAV: NavDef[] = [
  { to: '/', label: '대시보드', roles: ALL },
  { to: '/spots', label: '관광지', roles: ['SUPER_ADMIN', 'CONTENT_MANAGER', 'READ_ONLY'] },
  { to: '/courses', label: '코스', roles: ['SUPER_ADMIN', 'CONTENT_MANAGER', 'READ_ONLY'] },
  { to: '/users', label: '회원', roles: ['SUPER_ADMIN', 'OPERATION_MANAGER'] },
  { to: '/reports', label: '신고', roles: ['SUPER_ADMIN', 'OPERATION_MANAGER'] },
  { to: '/banners', label: '배너', roles: ['SUPER_ADMIN', 'MARKETER'] },
  { to: '/push', label: '푸시', roles: ['SUPER_ADMIN', 'MARKETER'] },
  { to: '/settlements', label: '정산', roles: ['SUPER_ADMIN', 'OPERATION_MANAGER'] },
]

const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: '총괄 관리자',
  CONTENT_MANAGER: '콘텐츠 매니저',
  OPERATION_MANAGER: '운영 매니저',
  MARKETER: '마케터',
  READ_ONLY: '읽기 전용',
}

const TITLES: Record<string, string> = {
  '/': '대시보드', '/spots': '관광지 관리', '/courses': '코스 관리',
  '/users': '회원 관리', '/reports': '신고 관리', '/banners': '배너 관리', '/push': '푸시 캠페인', '/settlements': '마켓 정산',
}

export function Layout() {
  const { role, logout } = useAuth()
  const loc = useLocation()
  const items = NAV.filter((n) => role && n.roles.includes(role))
  const base = '/' + (loc.pathname.split('/')[1] ?? '')
  const title = TITLES[base] ?? TITLES['/'] ?? 'TravelPack'

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <svg width="22" height="26" viewBox="0 0 120 140" aria-hidden="true">
            <rect x="18" y="10" width="84" height="120" rx="16" fill="#FF6B35" />
            <rect x="32" y="54" width="56" height="62" rx="8" fill="#fff" />
            <path d="M60,63 c-10,0 -16,7 -16,15 0,10 16,24 16,24 s16,-14 16,-24 c0,-8 -6,-15 -16,-15 z" fill="#1D3557" />
            <circle cx="60" cy="78" r="5" fill="#fff" />
          </svg>
          TravelPack
        </div>
        <nav>
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="who">
          {role ? ROLE_LABEL[role] : ''}
          <button onClick={logout}>로그아웃</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar"><h1>{title}</h1></header>
        <div className="content"><Outlet /></div>
      </div>
    </div>
  )
}
