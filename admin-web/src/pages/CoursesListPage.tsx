import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useResource } from '../api/hooks'
import { useAuth } from '../auth/AuthContext'
import { CourseStatusBadge } from '../components/ui'
import type { CourseListItem, ContentStatus, Paged } from '../api/types'

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'DRAFT', label: '작성중' },
  { value: 'IN_REVIEW', label: '검수중' },
  { value: 'PUBLISHED', label: '발행됨' },
  { value: 'ARCHIVED', label: '보관됨' },
]

export function CoursesListPage() {
  const { role } = useAuth()
  const nav = useNavigate()
  const canEdit = role === 'SUPER_ADMIN' || role === 'CONTENT_MANAGER'
  const [status, setStatus] = useState('')
  const { data, loading } = useResource<Paged<CourseListItem>>(
    `/admin/courses${status ? `?status=${status}` : ''}`, [status],
  )

  return (
    <div>
      <div className="page-head">
        <h2>코스</h2>
        {canEdit && <Link to="/courses/new" className="btn primary">+ 코스 등록</Link>}
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row wrap">
          {FILTERS.map((fl) => (
            <button key={fl.value}
              className={`btn sm ${status === fl.value ? 'navy' : 'ghost'}`}
              onClick={() => setStatus(fl.value)}>{fl.label}</button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? <div className="empty">불러오는 중…</div>
          : !data || data.items.length === 0 ? <div className="empty">코스가 없습니다</div>
            : (
              <table className="tbl">
                <thead>
                  <tr><th>제목</th><th>지역</th><th>상태</th><th>유형</th><th className="num">일수</th><th className="num">스팟</th><th>작성자</th><th className="num">가격</th><th className="num">저장</th></tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/courses/${c.id}`)}>
                      <td style={{ fontWeight: 500 }}>{c.title}</td>
                      <td className="muted">{c.region}</td>
                      <td><CourseStatusBadge status={c.status as ContentStatus} /></td>
                      <td><span className={`badge ${c.authorType === 'USER' ? 'warn' : ''}`}>{c.authorType === 'USER' ? '크리에이터' : '에디터'}</span></td>
                      <td className="num">{c.durationDays}일</td>
                      <td className="num">{c.spotCount}</td>
                      <td className="muted">{c.createdBy}</td>
                      <td className="num">{!c.price ? '무료' : `${c.price.toLocaleString()}원${c.salesCount ? ` · ${c.salesCount}판매` : ''}`}</td>
                      <td className="num">{c.saveCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
      </div>
    </div>
  )
}
