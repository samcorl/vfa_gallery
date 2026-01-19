# API Endpoints Specification
## You Should Be In . Pictures

RESTful API served via CloudFlare Workers/Pages Functions. All endpoints return JSON.

---

## Authentication

All authenticated endpoints require `Authorization: Bearer <token>` header.

### Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Initiate Google SSO |
| GET | `/api/auth/google/callback` | Google SSO callback |
| GET | `/api/auth/apple` | Initiate Apple SSO |
| GET | `/api/auth/apple/callback` | Apple SSO callback |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/me` | Get current user |

---

## Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/:username` | Public | Get public user profile |
| PATCH | `/api/users/me` | Required | Update current user profile |
| POST | `/api/users/me/avatar` | Required | Upload avatar |
| GET | `/api/users/me/stats` | Required | Get user stats (counts) |

### User Profile Response
```json
{
  "username": "sam-corl",
  "display_name": "Sam Corl",
  "avatar_url": "https://...",
  "bio": "...",
  "website": "https://samcorl.com",
  "socials": { "instagram": "...", "twitter": "..." },
  "galleries_count": 5,
  "artworks_count": 42
}
```

---

## Galleries

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/galleries` | Required | List current user's galleries |
| POST | `/api/galleries` | Required | Create gallery |
| GET | `/api/galleries/:id` | Owner | Get gallery by ID |
| PATCH | `/api/galleries/:id` | Owner | Update gallery |
| DELETE | `/api/galleries/:id` | Owner | Delete gallery |
| GET | `/api/users/:username/galleries` | Public | List user's public galleries |

### Public Gallery Endpoint (by slug)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/g/:artist/:gallery` | Public | Get gallery by slugs |

### Gallery Roles

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/galleries/:id/roles` | Owner | List gallery roles |
| POST | `/api/galleries/:id/roles` | Creator | Add gallery admin |
| DELETE | `/api/galleries/:id/roles/:userId` | Creator | Remove gallery admin |

---

## Collections

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/galleries/:galleryId/collections` | Owner/Public | List collections |
| POST | `/api/galleries/:galleryId/collections` | Owner | Create collection |
| GET | `/api/collections/:id` | Owner/Public | Get collection |
| PATCH | `/api/collections/:id` | Owner | Update collection |
| DELETE | `/api/collections/:id` | Owner | Delete collection |
| POST | `/api/collections/:id/copy` | Required | Copy collection |

### Public Collection Endpoint (by slug)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/g/:artist/:gallery/:collection` | Public | Get collection by slugs |

### Collection Artwork Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/collections/:id/artworks` | Owner/Public | List artworks in collection |
| POST | `/api/collections/:id/artworks` | Owner | Add artwork to collection |
| DELETE | `/api/collections/:id/artworks/:artworkId` | Owner | Remove artwork |
| PATCH | `/api/collections/:id/artworks/reorder` | Owner | Reorder artworks |

---

## Artworks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/artworks` | Required | List current user's artworks |
| POST | `/api/artworks` | Required | Create artwork (with upload) |
| GET | `/api/artworks/:id` | Owner/Public | Get artwork |
| PATCH | `/api/artworks/:id` | Owner | Update artwork metadata |
| DELETE | `/api/artworks/:id` | Owner | Soft-delete artwork |
| POST | `/api/artworks/:id/replace-image` | Owner | Replace artwork image |

### Public Artwork Endpoint (by slug)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/g/:artist/:gallery/:collection/:artwork` | Public | Get artwork by slugs |

### Artwork Upload Flow
1. `POST /api/artworks/upload-url` - Get presigned R2 upload URL
2. Upload image directly to R2
3. `POST /api/artworks` - Create artwork record with R2 key
4. Server generates thumbnail, icon, watermarked display version

---

## Browse & Search

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/browse/featured` | Public | Featured artists and artworks |
| GET | `/api/browse/recent` | Public | Recently posted artworks |
| GET | `/api/browse/categories` | Public | List categories |
| GET | `/api/browse/categories/:category` | Public | Artworks by category |
| GET | `/api/search` | Public | Search artworks |

### Search Parameters
```
GET /api/search?q=dragon&artist=sam&category=manga&from=2024-01-01&to=2024-12-31&page=1&limit=20
```

---

## Themes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/themes` | Public | List public + system themes |
| GET | `/api/themes/mine` | Required | List user's themes |
| POST | `/api/themes` | Required | Create theme |
| GET | `/api/themes/:id` | Public/Owner | Get theme |
| PATCH | `/api/themes/:id` | Owner | Update theme |
| DELETE | `/api/themes/:id` | Owner | Delete theme |
| POST | `/api/themes/:id/copy` | Required | Copy theme |

---

## Groups

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/groups` | Public | List public groups |
| POST | `/api/groups` | Required | Create group |
| GET | `/api/groups/:slug` | Public | Get group by slug |
| PATCH | `/api/groups/:id` | Admin | Update group |
| DELETE | `/api/groups/:id` | Owner | Delete group |
| GET | `/api/groups/:id/members` | Public | List group members |
| POST | `/api/groups/:id/members` | Admin | Add member |
| DELETE | `/api/groups/:id/members/:userId` | Admin | Remove member |
| POST | `/api/groups/:id/join` | Required | Request to join |
| POST | `/api/groups/:id/leave` | Required | Leave group |

---

## Messages

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/messages` | Required | List user's messages |
| POST | `/api/messages` | Required | Send message |
| GET | `/api/messages/:id` | Required | Get message |
| PATCH | `/api/messages/:id/read` | Required | Mark as read |
| DELETE | `/api/messages/:id` | Required | Delete message |

### Message Context
```json
{
  "recipient_id": "user-uuid",
  "context_type": "artwork",
  "context_id": "artwork-uuid",
  "subject": "Love your dragon piece!",
  "body": "The shading is incredible..."
}
```

---

## Admin Endpoints

All require `role: admin`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users (paginated) |
| GET | `/api/admin/users/:id` | Get user details (includes email) |
| PATCH | `/api/admin/users/:id` | Update user status/limits |
| POST | `/api/admin/users/:id/suspend` | Suspend user |
| POST | `/api/admin/users/:id/activate` | Activate user |
| GET | `/api/admin/messages/pending` | Get pending review queue |
| POST | `/api/admin/messages/:id/approve` | Approve message |
| POST | `/api/admin/messages/:id/reject` | Reject message |
| GET | `/api/admin/activity` | Activity log |
| GET | `/api/admin/stats` | Platform statistics |

---

## Common Response Formats

### Paginated Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": { "field": "email" }
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (not allowed)
- `404` - Not Found
- `409` - Conflict (duplicate slug, etc.)
- `429` - Rate Limited
- `500` - Server Error
