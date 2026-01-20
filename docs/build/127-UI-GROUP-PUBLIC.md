# Build 127: Group Public Page

## Goal

Create a public group page component that displays group information, description, contact details, and a members list with avatar links to member profiles. The page is accessible at `/groups/:slug`.

---

## Spec Extract

**Route:** `/groups/:slug`

**Page Components:**
```
┌──────────────────────────────────────┐
│ [Logo]  Group Name                   │
├──────────────────────────────────────┤
│ Description text here                │
│                                      │
│ Contact Info:                        │
│ Website: link                        │
│ Email: link                          │
│ Phone: display                       │
├──────────────────────────────────────┤
│ Members (5)                          │
│ [Avatar] [Avatar] [Avatar] ...       │
│ @username @username @username ...   │
│                                      │
│ [View All Members]                   │
└──────────────────────────────────────┘
```

**Features:**
- Display group logo (if available)
- Show group name and description
- Display contact information (website, email, phone)
- List social media links (Twitter, Instagram, etc.)
- Show member count with avatar grid
- Link each member avatar to their profile
- Display member usernames on hover or below avatars
- "View all members" button if more than 6 members
- Share group button
- Loading state while fetching group data
- 404 state if group not found

---

## Prerequisites

**Must complete before starting:**
- **123-API-GROUP-GET.md** - GET /api/groups/:slug endpoint (fetches group with members)
- **24-REACT-ROUTER-SETUP.md** - React Router route parameters
- **27-REACT-LAYOUT-SHELL.md** - Layout components and styling patterns
- **33-UI-PROFILE-VIEW.md** - Profile link patterns and components (for member profile links)

**Reason:** Component needs group data API endpoint, routing setup, shared layout patterns, and profile linking patterns.

---

## Steps

### Step 1: Create Group Page Component

Create the main public group page component.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GroupPage.tsx`

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GroupWithMembers } from '../types/group'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorState } from '../components/ErrorState'
import { GroupHeader } from '../components/GroupHeader'
import { GroupMembersList } from '../components/GroupMembersList'
import { GroupContactInfo } from '../components/GroupContactInfo'

/**
 * Public group page - displays group info and members
 * Route: /groups/:slug
 */
export function GroupPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [group, setGroup] = useState<GroupWithMembers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setError('Group slug is required')
      setLoading(false)
      return
    }

    const fetchGroup = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/groups/${slug}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Group not found')
          } else {
            setError('Failed to load group')
          }
          setGroup(null)
          return
        }

        const data = await response.json()
        setGroup(data.data)
      } catch (err) {
        console.error('[Group Page Error]', err)
        setError('Failed to load group')
        setGroup(null)
      } finally {
        setLoading(false)
      }
    }

    fetchGroup()
  }, [slug])

  if (loading) {
    return <LoadingSpinner />
  }

  if (error || !group) {
    return (
      <ErrorState
        title="Group Not Found"
        message={error || 'The group you are looking for does not exist.'}
        action={{
          label: 'Browse Groups',
          onClick: () => navigate('/groups'),
        }}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Group Header */}
      <GroupHeader group={group} />

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        {/* Left Column - Description and Contact */}
        <div className="md:col-span-2">
          {group.description && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-3">About</h2>
              <p className="text-gray-700 leading-relaxed">
                {group.description}
              </p>
            </section>
          )}

          {/* Contact Information */}
          <GroupContactInfo group={group} />
        </div>

        {/* Right Column - Members */}
        <div>
          <GroupMembersList
            members={group.members || []}
            memberCount={group.memberCount}
            groupSlug={group.slug}
          />
        </div>
      </div>
    </div>
  )
}
```

---

### Step 2: Create Group Header Component

Create component for group header with logo, name, and basic info.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/GroupHeader.tsx`

```typescript
import { GroupWithMembers } from '../types/group'
import { ShareButton } from './ShareButton'

interface GroupHeaderProps {
  group: GroupWithMembers
}

/**
 * Displays group logo, name, and actions
 */
export function GroupHeader({ group }: GroupHeaderProps) {
  const groupUrl = `${window.location.origin}/groups/${group.slug}`

  return (
    <div className="flex items-start gap-6 pb-6 border-b">
      {/* Logo */}
      {group.logoUrl && (
        <div className="flex-shrink-0">
          <img
            src={group.logoUrl}
            alt={group.name}
            className="w-24 h-24 rounded-lg object-cover"
          />
        </div>
      )}

      {/* Info */}
      <div className="flex-1">
        <h1 className="text-3xl font-bold mb-2">{group.name}</h1>
        <p className="text-gray-600 mb-4">
          {group.memberCount || 0} {group.memberCount === 1 ? 'member' : 'members'}
        </p>

        {/* Social Links */}
        {group.socials && Object.entries(group.socials).length > 0 && (
          <div className="flex gap-3 mb-4">
            {group.socials.twitter && (
              <a
                href={`https://twitter.com/${group.socials.twitter.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline text-sm"
              >
                Twitter
              </a>
            )}
            {group.socials.instagram && (
              <a
                href={`https://instagram.com/${group.socials.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline text-sm"
              >
                Instagram
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <ShareButton
            title={group.name}
            url={groupUrl}
            description={`Check out ${group.name} on the gallery`}
          />
        </div>
      </div>
    </div>
  )
}
```

---

### Step 3: Create Contact Info Component

Create component for displaying contact information.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/GroupContactInfo.tsx`

```typescript
import { GroupWithMembers } from '../types/group'
import { EnvelopeIcon, LinkIcon, PhoneIcon } from '@heroicons/react/24/outline'

interface GroupContactInfoProps {
  group: GroupWithMembers
}

/**
 * Displays group contact information
 */
export function GroupContactInfo({ group }: GroupContactInfoProps) {
  const hasContactInfo = group.website || group.email || group.phone

  if (!hasContactInfo) {
    return null
  }

  return (
    <section className="bg-gray-50 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Contact Information</h2>

      <div className="space-y-3">
        {group.website && (
          <div className="flex items-center gap-3">
            <LinkIcon className="w-5 h-5 text-gray-600" />
            <a
              href={group.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {group.website}
            </a>
          </div>
        )}

        {group.email && (
          <div className="flex items-center gap-3">
            <EnvelopeIcon className="w-5 h-5 text-gray-600" />
            <a
              href={`mailto:${group.email}`}
              className="text-blue-600 hover:underline"
            >
              {group.email}
            </a>
          </div>
        )}

        {group.phone && (
          <div className="flex items-center gap-3">
            <PhoneIcon className="w-5 h-5 text-gray-600" />
            <a
              href={`tel:${group.phone}`}
              className="text-blue-600 hover:underline"
            >
              {group.phone}
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
```

---

### Step 4: Create Members List Component

Create component for displaying group members.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/GroupMembersList.tsx`

```typescript
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GroupMemberDetail } from '../types/group'

interface GroupMembersListProps {
  members: GroupMemberDetail[]
  memberCount: number
  groupSlug: string
}

const PREVIEW_COUNT = 6

/**
 * Displays group members with avatars
 */
export function GroupMembersList({
  members,
  memberCount,
  groupSlug,
}: GroupMembersListProps) {
  const [showAll, setShowAll] = useState(false)
  const displayMembers = showAll ? members : members.slice(0, PREVIEW_COUNT)
  const hasMore = members.length > PREVIEW_COUNT

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Members ({memberCount})</h2>

      <div className="bg-gray-50 rounded-lg p-4">
        {members.length === 0 ? (
          <p className="text-gray-500 text-sm">No members yet</p>
        ) : (
          <>
            {/* Avatar Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {displayMembers.map((member) => (
                <Link
                  key={member.userId}
                  to={`/users/${member.username}`}
                  className="flex flex-col items-center group"
                >
                  <div className="w-14 h-14 rounded-full bg-gray-300 mb-2 group-hover:shadow-lg transition-shadow" />
                  <p className="text-xs text-center text-gray-700 group-hover:text-blue-600 truncate w-full">
                    @{member.username}
                  </p>
                  {member.role !== 'member' && (
                    <p className="text-xs text-gray-500 capitalize">
                      {member.role}
                    </p>
                  )}
                </Link>
              ))}
            </div>

            {/* Member Badges if role is special */}
            {hasMore && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-2 text-sm text-blue-600 hover:bg-white rounded transition-colors"
              >
                View all {memberCount} members
              </button>
            )}

            {showAll && hasMore && (
              <button
                onClick={() => setShowAll(false)}
                className="w-full py-2 text-sm text-blue-600 hover:bg-white rounded transition-colors"
              >
                Show less
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
```

---

### Step 5: Add Route to Router Configuration

Add the group page route to your router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

```typescript
import { GroupPage } from './pages/GroupPage'

// Add this route to your router:
<Route path="/groups/:slug" element={<GroupPage />} />
```

---

### Step 6: Create Groups List Route (Optional Navigation)

Create a groups discovery page for browsing all groups.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GroupsPage.tsx`

```typescript
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GroupResponse } from '../types/group'
import { LoadingSpinner } from '../components/LoadingSpinner'

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await fetch('/api/groups')
        if (!response.ok) throw new Error('Failed to fetch groups')
        const data = await response.json()
        setGroups(data.data || [])
      } catch (err) {
        console.error('[Groups List Error]', err)
        setError('Failed to load groups')
      } finally {
        setLoading(false)
      }
    }

    fetchGroups()
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Browse Groups</h1>

      {error ? (
        <div className="text-red-600">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/groups/${group.slug}`}
              className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              {group.logoUrl && (
                <img
                  src={group.logoUrl}
                  alt={group.name}
                  className="w-full h-32 rounded object-cover mb-3"
                />
              )}
              <h3 className="font-bold text-lg mb-1">{group.name}</h3>
              <p className="text-sm text-gray-600 mb-2">
                {group.memberCount} members
              </p>
              {group.description && (
                <p className="text-sm text-gray-700 line-clamp-2">
                  {group.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## Files to Create/Modify

**New files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GroupPage.tsx` - Main group page
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/GroupHeader.tsx` - Group header with logo and name
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/GroupContactInfo.tsx` - Contact information display
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/GroupMembersList.tsx` - Members list with avatars
5. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GroupsPage.tsx` - Groups discovery page (optional)

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` - Add routes

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 2: Navigate to Non-Existent Group

```bash
# In browser
http://localhost:5173/groups/nonexistent-group
```

Expected: Error state displays "Group not found"

---

### Test 3: Create Test Group and View Page

Via API:
```bash
curl -X POST http://localhost:8788/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "Test Studio",
    "description": "A test studio group",
    "website": "https://teststudio.com",
    "email": "contact@teststudio.com",
    "phone": "+1-555-0100"
  }'
```

Then in browser:
```bash
http://localhost:5173/groups/test-studio
```

Expected: Group page loads with all information displayed

---

### Test 4: Display Group Header

Expected: Group logo, name, and member count display correctly

---

### Test 5: Display Contact Information

Expected: Website, email, and phone links are clickable and properly formatted

---

### Test 6: Display Members List

Expected: Member avatars appear in grid, usernames display, role badges show

---

### Test 7: Members Link to Profiles

Click on member avatar:

Expected: Navigates to /users/username page

---

### Test 8: Show More Members Button

Create a group with 8+ members, view page:

Expected: "View all members" button appears, clicking shows all members

---

### Test 9: Share Button

Expected: Share button opens share dialog with group URL

---

### Test 10: Responsive Layout

View on mobile, tablet, desktop:

Expected: Layout adapts, members grid responsive, text readable

---

## Success Criteria

- [ ] TypeScript compilation succeeds
- [ ] /groups/:slug route works
- [ ] Group page loads data from API
- [ ] Group logo displays (if available)
- [ ] Group name and description display
- [ ] Member count displays correctly
- [ ] Contact information displays correctly
- [ ] Website link is clickable
- [ ] Email link opens mail client
- [ ] Phone link is callable
- [ ] Social media links work
- [ ] Members grid displays
- [ ] Member avatars display
- [ ] Member usernames display
- [ ] Member links navigate to profiles
- [ ] Role badges show for managers/owners
- [ ] "View all members" works
- [ ] 404 state when group not found
- [ ] Loading state displays
- [ ] Share button works
- [ ] Responsive on mobile/tablet

---

## Next Steps

Once this build is verified, proceed to **128-UI-GROUP-MANAGE.md** to create the group management page for admins.
