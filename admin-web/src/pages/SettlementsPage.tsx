import { useResource } from '../api/hooks'

interface CreatorRow {
  authorId: string
  nickname: string
  salesCount: number
  gross: number
  platformFee: number
  payout: number
}
interface Settlements {
  summary: { paidCount: number; grossRevenue: number; platformFee: number; creatorPayout: number; feePercent: number }
  creators: CreatorRow[]
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

export function SettlementsPage() {
  const { data, loading, error } = useResource<Settlements>('/admin/marketplace/settlements')

  return (
    <div>
      <div className="page-head"><h2>정산</h2></div>

      {loading ? (
        <div className="card"><div className="empty">불러오는 중…</div></div>
      ) : error ? (
        <div className="card"><div className="empty">{error}</div></div>
      ) : !data ? null : (
        <>
          <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <Stat label="총 매출 (PAID)" value={won(data.summary.grossRevenue)} sub={`${data.summary.paidCount}건`} />
            <Stat label={`플랫폼 수수료 (${data.summary.feePercent}%)`} value={won(data.summary.platformFee)} />
            <Stat label="크리에이터 지급 합계" value={won(data.summary.creatorPayout)} />
          </div>

          <div className="card">
            {data.creators.length === 0 ? (
              <div className="empty">아직 판매된 유료 코스가 없습니다</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr><th>크리에이터</th><th style={{ textAlign: 'right' }}>판매</th><th style={{ textAlign: 'right' }}>매출</th><th style={{ textAlign: 'right' }}>수수료</th><th style={{ textAlign: 'right' }}>지급액</th></tr>
                </thead>
                <tbody>
                  {data.creators.map((c) => (
                    <tr key={c.authorId}>
                      <td>{c.nickname}</td>
                      <td style={{ textAlign: 'right' }} className="muted">{c.salesCount}건</td>
                      <td style={{ textAlign: 'right' }}>{won(c.gross)}</td>
                      <td style={{ textAlign: 'right' }} className="muted">−{won(c.platformFee)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{won(c.payout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            * 결제 완료(PAID) 기준 집계입니다. 실제 지급 시 비사업자 크리에이터는 원천징수(3.3%) 등 세무 처리가 별도로 적용됩니다.
          </p>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card card-pad" style={{ flex: 1, minWidth: 180 }}>
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
