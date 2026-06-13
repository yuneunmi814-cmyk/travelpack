import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { pinoHttp } from 'pino-http'
import { isTest } from './config/env.js'
import { h } from './lib/respond.js'
import { rateLimit } from './middleware/rateLimit.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { authRouter } from './modules/auth/auth.router.js'
import { usersRouter } from './modules/users/users.router.js'
import { exploreRouter } from './modules/explore/explore.router.js'
import { bookmarksRouter } from './modules/bookmarks/bookmarks.router.js'
import { tripsRouter } from './modules/trips/trips.router.js'
import { reviewsRouter } from './modules/reviews/reviews.router.js'
import { creatorRouter } from './modules/creator/creator.router.js'
import { marketplaceRouter } from './modules/marketplace/marketplace.router.js'
import { uploadsRouter } from './modules/uploads/uploads.router.js'
import { adminAuthRouter } from './modules/admin/adminAuth.router.js'
import { adminContentRouter } from './modules/admin/adminContent.router.js'
import { adminOpsRouter } from './modules/admin/adminOps.router.js'

// API 응답의 BigInt(id)는 문자열로 직렬화
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(BigInt.prototype as any).toJSON = function (this: bigint) {
  return this.toString()
}

export function createApp(): express.Express {
  const app = express()
  app.set('trust proxy', true)
  app.use(helmet())
  app.use(cors())
  // 원본 바디 보관(PortOne 웹훅 서명 검증용) — json 파싱은 그대로 동작
  app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as { rawBody?: Buffer }).rawBody = buf } }))
  if (!isTest) app.use(pinoHttp({ autoLogging: { ignore: (req) => req.url === '/health' } }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  const api = express.Router()
  api.use(h(rateLimit))
  api.use('/auth', authRouter)
  api.use('/users', usersRouter)
  api.use(exploreRouter)   // /home /regions /themes /courses /spots /search
  api.use(bookmarksRouter) // /bookmarks /users/me/bookmarks
  api.use(tripsRouter)     // /trips*
  api.use(reviewsRouter)   // /reviews* /courses/:id/reviews /spots/:id/reviews /users/me/reviews
  api.use(creatorRouter)   // /me/courses* (크리에이터 코스 작성·검수요청)
  api.use(marketplaceRouter) // /marketplace/courses* /me/purchases (구매·이용권)
  api.use(uploadsRouter)   // /uploads/presigned-url
  api.use('/admin', adminAuthRouter, adminContentRouter, adminOpsRouter)

  app.use('/api/v1', api)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
