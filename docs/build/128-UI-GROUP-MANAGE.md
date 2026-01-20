# Build 128: Group Management Page

## Goal

Create a group management page for group owners and admins to edit group information, manage members, and change member roles. The page is accessible at `/groups/:slug/manage` and restricted to group owners/managers.

---

## Spec Extract

**Route:** `/groups/:slug/manage` (protected - requires owner/manager role)

**Page Components:**
```
┌────────────────────────────────────────┐
│ [Logo] Group Settings                  │
├────────────────────────────────────────┤
│ Edit Group Information                 │
│ Name: [input]                          │
│ Description: [textarea]                │
│ Logo: [upload] [preview]               │
│ Website: [input]                       │
│ Email: [input]                         │
│ Phone: [input]                         │
│ Socials: Twitter, Instagram...        │
│ [Save Changes]                         │
├────────────────────────────────────────┤
│ Members Management                     │
│ [+Add Member] [Search...]              │
│                                        │
│ Name    | Role          | Actions      │
│ alice   | Owner         | -            │
│ bob     | Manager       | [Change] [X] │
│ charlie | Member        | [Change] [X] │
│ diana   | (invited)     | [Cancel]     │
│                                        │
│ [Add Member Modal]                     │
│ Username: [input]                      │
│ Role: [Owner/Manager/Member]           │
│ [Invite]                               │
└────────────────────────────────────────┘
```

**Features:**
- Edit form with group name, description, logo, contact info, socials
- Members table with role and actions
- Add new member by username
- Change member role dropdown
- Remove member button with confirmation
- Owner cannot be removed
- Pending invitations display
- Form validation
- Optimistic UI updates
- Save status indicators
- Confirmation dialogs for destructive actions

---

## Prerequisites

**Must complete before starting:**
- **127-UI-GROUP-PUBLIC.md** - Group page component
- **126-API-GROUP-MEMBERS.md** - Member management API endpoints
- **124-API-GROUP-UPDATE.md** - Group update endpoint
- **26-REACT-PROTECTED-ROUTES.md** - Protected route patterns for owner/manager only
- **28-REACT-TOAST-SYSTEM.md** - Toast notifications for feedback

**Reason:** Component needs group data, member management APIs, protected route patterns, and toast system.

---

## Steps

### Step 1: Create Group Management Page Component

Create the main management page container.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GroupManagePage.tsx`

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import { GroupWithMembers } from '../types/group'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorState } from '../components/ErrorState'
import { GroupEditForm } from '../components/GroupEditForm'
import { GroupMembersManager } from '../components/GroupMembersManager'

/**
 * Group management page - for owners and managers only
 * Route: /groups/:slug/manage
 */
export function GroupManagePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [group, setGroup] = useState<GroupWithMembers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOwnerOrManager, setIsOwnerOrManager] = useState(false)

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

        const response = await fetch(`/api/groups/${slug}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        })

        if (!response.ok) {
          if (response.status === 404) {
            setError('Group not found')
          } else {
            setError('Failed to load group')
          }
          return
        }

        const data = await response.json()
        const groupData = data.data as GroupWithMembers

        // Check if current user is owner or manager
        const userRole = groupData.members?.find(
          (m) => m.userId === user?.id
        )?.role

        if (!userRole || !['owner', 'manager'].includes(userRole)) {
          setError('You do not have permission to manage this group')
          setIsOwnerOrManager(false)
          return
        }

        setGroup(groupData)
        setIsOwnerOrManager(true)
      } catch (err) {
        console.error('[Group Manage Error]', err)
        setError('Failed to load group')
      } finally {
        setLoading(false)
      }
    }

    if (user?.id) {
      fetchGroup()
    } else {
      setError('You must be logged in to manage a group')
      setLoading(false)
    }
  }, [slug, user?.id])

  const handleGroupUpdate = (updatedGroup: GroupWithMembers) => {
    setGroup(updatedGroup)
    showToast('Group updated successfully', 'success')
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (error || !group || !isOwnerOrManager) {
    return (
      <ErrorState
        title="Access Denied"
        message={
          error || 'You do not have permission to manage this group.'
        }
        action={{
          label: `Back to ${group?.name || 'Group'}`,
          onClick: () => navigate(`/groups/${slug}`),
        }}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Group Settings</h1>
        <p className="text-gray-600">Manage {group.name} information and members</p>
      </div>

      {/* Edit Group Form */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Edit Group Information</h2>
        <GroupEditForm group={group} onUpdate={handleGroupUpdate} />
      </section>

      {/* Members Manager */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Manage Members</h2>
        <GroupMembersManager
          group={group}
          onUpdate={handleGroupUpdate}
        />
      </section>
    </div>
  )
}
```

---

### Step 2: Create Group Edit Form Component

Create form for editing group information.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/GroupEditForm.tsx`

```typescript
import { useState, useCallback } from 'react'
import { GroupWithMembers } from '../types/group'
import { useToast } from '../hooks/useToast'

interface GroupEditFormProps {
  group: GroupWithMembers
  onUpdate: (updatedGroup: GroupWithMembers) => void
}

/**
 * Form for editing group information
 */
export function GroupEditForm({ group, onUpdate }: GroupEditFormProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: group.name,
    description: group.description || '',
    website: group.website || '',
    email: group.email || '',
    phone: group.phone || '',
    twitterHandle: group.socials?.twitter || '',
    instagramHandle: group.socials?.instagram || '',
  })

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    },
    []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/groups/${group.slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          website: formData.website || null,
          email: formData.email || null,
          phone: formData.phone || null,
          socials: {
            twitter: formData.twitterHandle || null,
            instagram: formData.instagramHandle || null,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error?.message || 'Failed to update group', 'error')
        return
      }

      const data = await response.json()
      onUpdate(data.data)
      showToast('Group updated successfully', 'success')
    } catch (err) {
      console.error('[Group Edit Error]', err)
      showToast('Failed to update group', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Group Name
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tell people about your group..."
        />
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Website
        </label>
        <input
          type="url"
          name="website"
          value={formData.website}
          onChange={handleChange}
          placeholder="https://example.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="contact@example.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone
        </label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="+1-555-0100"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Social Media */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-gray-900">Social Media</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Twitter Handle
          </label>
          <div className="flex items-center">
            <span className="text-gray-600 mr-2">@</span>
            <input
              type="text"
              name="twitterHandle"
              value={formData.twitterHandle}
              onChange={handleChange}
              placeholder="studioname"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Instagram Handle
          </label>
          <div className="flex items-center">
            <span className="text-gray-600 mr-2">@</span>
            <input
              type="text"
              name="instagramHandle"
              value={formData.instagramHandle}
              onChange={handleChange}
              placeholder="studioname"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-6 border-t">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
```

---

### Step 3: Create Members Manager Component

Create component for managing group members.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/GroupMembersManager.tsx`

```typescript
import { useState } from 'react'
import { GroupWithMembers, GroupMemberDetail } from '../types/group'
import { useToast } from '../hooks/useToast'
import { AddMemberModal } from './AddMemberModal'
import { ConfirmDialog } from './ConfirmDialog'

interface GroupMembersManagerProps {
  group: GroupWithMembers
  onUpdate: (updatedGroup: GroupWithMembers) => void
}

type MemberRole = 'owner' | 'manager' | 'member'

/**
 * Component for managing group members
 */
export function GroupMembersManager({
  group,
  onUpdate,
}: GroupMembersManagerProps) {
  const { showToast } = useToast()
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<{
    member: GroupMemberDetail
    index: number
  } | null>(null)
  const [changeRoleFor, setChangeRoleFor] = useState<{
    member: GroupMemberDetail
    index: number
  } | null>(null)

  const handleAddMember = async (username: string, role: MemberRole) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/groups/${group.slug}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ username, role }),
      })

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error?.message || 'Failed to add member', 'error')
        return
      }

      const data = await response.json()
      onUpdate(data.data)
      setShowAddModal(false)
      showToast('Member added successfully', 'success')
    } catch (err) {
      console.error('[Add Member Error]', err)
      showToast('Failed to add member', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/groups/${group.slug}/members/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error?.message || 'Failed to remove member', 'error')
        return
      }

      const data = await response.json()
      onUpdate(data.data)
      setConfirmRemove(null)
      showToast('Member removed successfully', 'success')
    } catch (err) {
      console.error('[Remove Member Error]', err)
      showToast('Failed to remove member', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleChangeRole = async (
    userId: string,
    newRole: MemberRole
  ) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/groups/${group.slug}/members/${userId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ role: newRole }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        showToast(error.error?.message || 'Failed to change role', 'error')
        return
      }

      const data = await response.json()
      onUpdate(data.data)
      setChangeRoleFor(null)
      showToast('Member role updated', 'success')
    } catch (err) {
      console.error('[Change Role Error]', err)
      showToast('Failed to change role', 'error')
    } finally {
      setLoading(false)
    }
  }

  const members = group.members || []
  const ownerCount = members.filter((m) => m.role === 'owner').length

  return (
    <div className="space-y-4">
      {/* Add Member Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          + Add Member
        </button>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Member
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Username
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Role
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr key={member.userId} className="border-b hover:bg-gray-50">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-300" />
                  </div>
                </td>
                <td className="px-6 py-3 text-sm">@{member.username}</td>
                <td className="px-6 py-3 text-sm">
                  {member.role === 'owner' ? (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                      Owner
                    </span>
                  ) : member.role === 'manager' ? (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      Manager
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                      Member
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-3 text-right space-x-2">
                  {member.role !== 'owner' && (
                    <>
                      <button
                        onClick={() =>
                          setChangeRoleFor({ member, index })
                        }
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        Change Role
                      </button>
                      <button
                        onClick={() =>
                          setConfirmRemove({ member, index })
                        }
                        className="text-red-600 hover:underline text-sm font-medium"
                      >
                        Remove
                      </button>
                    </>
                  )}
                  {member.role === 'owner' && ownerCount === 1 && (
                    <span className="text-gray-500 text-sm">
                      Cannot remove (only owner)
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {members.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            No members yet
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <AddMemberModal
          onAdd={handleAddMember}
          onClose={() => setShowAddModal(false)}
          loading={loading}
        />
      )}

      {/* Confirm Remove Dialog */}
      {confirmRemove && (
        <ConfirmDialog
          title="Remove Member"
          message={`Remove @${confirmRemove.member.username} from the group?`}
          confirmLabel="Remove"
          confirmDanger
          onConfirm={() =>
            handleRemoveMember(confirmRemove.member.userId)
          }
          onCancel={() => setConfirmRemove(null)}
          loading={loading}
        />
      )}

      {/* Change Role Modal */}
      {changeRoleFor && (
        <RoleChangeModal
          member={changeRoleFor.member}
          onChangeRole={(role) =>
            handleChangeRole(changeRoleFor.member.userId, role)
          }
          onClose={() => setChangeRoleFor(null)}
          loading={loading}
        />
      )}
    </div>
  )
}

/**
 * Modal for changing member role
 */
function RoleChangeModal({
  member,
  onChangeRole,
  onClose,
  loading,
}: {
  member: GroupMemberDetail
  onChangeRole: (role: MemberRole) => Promise<void>
  onClose: () => void
  loading: boolean
}) {
  const [selectedRole, setSelectedRole] = useState<MemberRole>(
    member.role
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold mb-4">Change Role for @{member.username}</h3>

        <div className="space-y-2 mb-6">
          {(['owner', 'manager', 'member'] as const).map((role) => (
            <label key={role} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
              <input
                type="radio"
                name="role"
                value={role}
                checked={selectedRole === role}
                onChange={(e) =>
                  setSelectedRole(e.target.value as MemberRole)
                }
              />
              <span className="capitalize font-medium">{role}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onChangeRole(selectedRole)}
            disabled={loading || selectedRole === member.role}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Updating...' : 'Update Role'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### Step 4: Create Add Member Modal Component

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/AddMemberModal.tsx`

```typescript
import { useState } from 'react'

interface AddMemberModalProps {
  onAdd: (username: string, role: 'owner' | 'manager' | 'member') => void
  onClose: () => void
  loading: boolean
}

export function AddMemberModal({
  onAdd,
  onClose,
  loading,
}: AddMemberModalProps) {
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<'owner' | 'manager' | 'member'>('member')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim()) {
      onAdd(username.trim(), role)
      setUsername('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold mb-4">Add Member to Group</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as 'owner' | 'manager' | 'member')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

---

### Step 5: Create Confirmation Dialog Component

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ConfirmDialog.tsx`

```typescript
interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmDanger?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmDanger = false,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-white rounded-lg transition-colors font-medium ${
              confirmDanger
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-gray-400'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400'
            }`}
          >
            {loading ? 'Loading...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### Step 6: Add Route to Router

Add the management route to protected routes.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

```typescript
import { GroupManagePage } from './pages/GroupManagePage'

// Add this route (protected):
<Route
  path="/groups/:slug/manage"
  element={
    <ProtectedRoute>
      <GroupManagePage />
    </ProtectedRoute>
  }
/>
```

---

## Files to Create/Modify

**New files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/GroupManagePage.tsx` - Main management page
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/GroupEditForm.tsx` - Group edit form
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/GroupMembersManager.tsx` - Members management
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/AddMemberModal.tsx` - Add member modal
5. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/ConfirmDialog.tsx` - Confirmation dialog

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` - Add route

---

## Verification

### Test 1: Verify TypeScript Compilation

```bash
npx tsc --noEmit
```

Expected: No errors

---

### Test 2: Access Without Authentication

Navigate to `/groups/test-studio/manage`:

Expected: Redirects to login or shows access denied

---

### Test 3: Access as Non-Owner/Manager

Create group, add another user (not as manager/owner), try to access manage page:

Expected: Error state - "You do not have permission"

---

### Test 4: Access as Owner

Create group as user A, log in as A, navigate to `/groups/studio-name/manage`:

Expected: Management page loads with form and members table

---

### Test 5: Edit Group Information

Change name, description, website, email:

Expected: Form submits, group updates, success toast shows

---

### Test 6: Add Member

Click "Add Member", enter username, select role:

Expected: Member added to table with role badge

---

### Test 7: Change Member Role

Click "Change Role" on a member:

Expected: Role dropdown appears, selection updates member role

---

### Test 8: Remove Member

Click "Remove" on a member:

Expected: Confirmation dialog shows, clicking remove deletes member from table

---

### Test 9: Cannot Remove Owner

Try to remove owner (no remove button should appear):

Expected: Remove button hidden for owner role, or message shows "only owner"

---

### Test 10: Social Media Form

Enter Twitter and Instagram handles:

Expected: Fields save with @ stripped and values stored correctly

---

### Test 11: Form Validation

Try to save with empty required fields:

Expected: Form validation errors or fields required

---

### Test 12: Optimistic Updates

Make a change and observe UI:

Expected: UI updates immediately, loading state shows while saving

---

### Test 13: Error Handling

Simulate API error (network offline, etc.):

Expected: Error toast displays, user can retry

---

### Test 14: Member Joined Date

View members table:

Expected: Joined date displays for each member

---

## Success Criteria

- [ ] TypeScript compilation succeeds
- [ ] Route /groups/:slug/manage works
- [ ] Protected route - redirects non-authenticated users
- [ ] Protected route - shows access denied for non-owners
- [ ] Group edit form displays
- [ ] Edit form saves changes to API
- [ ] Form validation works
- [ ] Members table displays all members
- [ ] Members show with role badges
- [ ] Add member button works
- [ ] Add member modal opens/closes
- [ ] Can add member by username
- [ ] New members appear in table
- [ ] Can change member role
- [ ] Can remove members
- [ ] Cannot remove owner (last one)
- [ ] Success toasts show on updates
- [ ] Error toasts show on failures
- [ ] Confirmation dialogs for destructive actions
- [ ] Loading states show during API calls
- [ ] Responsive on mobile

---

## Next Steps

This completes the group functionality. Consider building group discovery features or integrating group management into navigation menus.
