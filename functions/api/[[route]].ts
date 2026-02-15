import { handle } from 'hono/cloudflare-pages'
import { app } from '../../src/lib/api'

export const onRequest = handle(app)
