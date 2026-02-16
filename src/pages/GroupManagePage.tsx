import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/ui/Avatar'
import {
  ArrowLeft,
  Save,
  UserPlus,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle,
} from 'lucide-react'

interface Member {
  userId: string
  username: string
  displayName: string
  avatarUrl: string
  role: 'member' | 'manager' | 'owner'
  joinedAt: string
}

interface GroupData {
  id: string
  slug: string
  name: string
  website?: string
  email?: string
  phone?: string
  socials?: Record<string, string>
  logoUrl?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  members: Member[]
  memberCount: number
  userRole?: 'member' | 'manager' | 'owner' | null
}

interface FormData {
  name: string
  website: string
  email: string
  phone: string
  twitter: string
  instagram: string
}

export default function GroupManagePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  useAuth()

  const [group, setGroup] = useState<GroupData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)

  // Form states
  const [formData, setFormData] = useState<FormData>({
    name: '',
    website: '',
    email: '',
    phone: '',
    twitter: '',
    instagram: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Add member states
  const [newUserId, setNewUserId] = useState('')
  const [newUserRole, setNewUserRole] = useState<'member' | 'manager'>('member')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Delete member states
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchGroup = async () => {
      if (!slug) return

      try {
        setLoading(true)
        setError(null)
        setNotFound(false)
        setAccessDenied(false)

        const response = await fetch(`/api/groups/${slug}`, {
          credentials: 'include',
        })

        if (response.status === 404) {
          setNotFound(true)
          setLoading(false)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to fetch group')
        }

        const data = await response.json()
        const groupData: GroupData = data.data

        // Check access
        if (groupData.userRole !== 'owner' && groupData.userRole !== 'manager') {
          setAccessDenied(true)
          setLoading(false)
          return
        }

        setGroup(groupData)
        setMembers(groupData.members)

        // Initialize form
        setFormData({
          name: groupData.name || '',
          website: groupData.website || '',
          email: groupData.email || '',
          phone: groupData.phone || '',
          twitter: groupData.socials?.twitter || '',
          instagram: groupData.socials?.instagram || '',
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    fetchGroup()
  }, [slug])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSaveChanges = async () => {
    if (!group) return

    if (!formData.name.trim()) {
      setSaveError('Group name is required')
      return
    }

    try {
      setSaving(true)
      setSaveError(null)
      setSaveSuccess(false)

      const body: any = {
        name: formData.name.trim(),
      }

      if (formData.website.trim()) body.website = formData.website.trim()
      if (formData.email.trim()) body.email = formData.email.trim()
      if (formData.phone.trim()) body.phone = formData.phone.trim()

      // Build socials object
      const socials: Record<string, string | null> = {}
      if (formData.twitter.trim()) socials.twitter = formData.twitter.trim()
      else socials.twitter = null
      if (formData.instagram.trim()) socials.instagram = formData.instagram.trim()
      else socials.instagram = null

      if (Object.values(socials).some((v) => v !== null)) {
        body.socials = socials
      }

      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error('Failed to update group')
      }

      const data = await response.json()
      setGroup(data.data)
      setSaveSuccess(true)

      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async () => {
    if (!group) return

    if (!newUserId.trim()) {
      setAddError('User ID is required')
      return
    }

    try {
      setAdding(true)
      setAddError(null)

      const response = await fetch(`/api/groups/${group.id}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newUserId.trim(),
          role: newUserRole,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || 'Failed to add member')
      }

      const data = await response.json()
      setMembers([...members, data.data])
      setNewUserId('')
      setNewUserRole('member')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!group) return

    if (!window.confirm('Are you sure you want to remove this member?')) {
      return
    }

    try {
      setDeletingUserId(userId)

      const response = await fetch(`/api/groups/${group.id}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to remove member')
      }

      setMembers(members.filter((m) => m.userId !== userId))
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setDeletingUserId(null)
    }
  }

  const handleDeleteGroup = async () => {
    if (!group) return

    if (
      !window.confirm(
        'Are you sure you want to delete this group? This cannot be undone.'
      )
    ) {
      return
    }

    try {
      setSaving(true)

      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete group')
      }

      navigate('/groups')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete group')
      setSaving(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      </div>
    )
  }

  // Not found state
  if (notFound) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <AlertCircle className="w-12 h-12 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900">Group not found</h1>
          <p className="text-gray-600">
            The group you're looking for doesn't exist or has been removed.
          </p>
          <Link to="/groups" className="text-blue-600 hover:underline mt-4">
            Back to Groups
          </Link>
        </div>
      </div>
    )
  }

  // Access denied state
  if (accessDenied) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600">
            You don't have permission to manage this group.
          </p>
          <Link to={group ? `/groups/${group.slug}` : '/groups'} className="text-blue-600 hover:underline mt-4">
            Back to Group
          </Link>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !group) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h1 className="text-2xl font-bold text-gray-900">Error</h1>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!group) return null

  const isOwner = group.userRole === 'owner'

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Back button */}
      <Link
        to={`/groups/${slug}`}
        className="flex items-center gap-2 text-blue-600 hover:underline mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Group
      </Link>

      {/* Page header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Group Settings</h1>
        <p className="text-gray-600">{group.name}</p>
      </div>

      {/* Global error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Edit Group Form */}
      <div className="mb-12 border border-gray-200 rounded-lg p-6 bg-white">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Group Information</h2>

        <div className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Group Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              placeholder="My Group"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Website
            </label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              placeholder="https://example.com"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              placeholder="hello@example.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          {/* Social Media */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Social Media</h3>

            <div className="space-y-4">
              {/* Twitter */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Twitter Handle
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">@</span>
                  <input
                    type="text"
                    name="twitter"
                    value={formData.twitter}
                    onChange={handleInputChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="handle"
                  />
                </div>
              </div>

              {/* Instagram */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Instagram Handle
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">@</span>
                  <input
                    type="text"
                    name="instagram"
                    value={formData.instagram}
                    onChange={handleInputChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="handle"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form messages */}
        {saveError && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{saveError}</p>
          </div>
        )}

        {saveSuccess && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">Changes saved successfully</p>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSaveChanges}
          disabled={saving}
          className="mt-6 flex items-center gap-2 px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Members Management */}
      <div className="mb-12 border border-gray-200 rounded-lg p-6 bg-white">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Members <span className="text-lg font-normal text-gray-500">({group.memberCount})</span>
        </h2>

        {/* Add member section */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Add New Member</h3>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="User ID"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
            />
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as 'member' | 'manager')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
            >
              <option value="member">Member</option>
              <option value="manager">Manager</option>
            </select>
            <button
              onClick={handleAddMember}
              disabled={adding}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Add
            </button>
          </div>
          {addError && (
            <p className="text-sm text-red-600">
              {addError}
            </p>
          )}
        </div>

        {/* Members table */}
        {members.length === 0 ? (
          <p className="text-gray-500">No members yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Joined</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {members.map((member) => (
                  <tr key={member.userId} className="hover:bg-gray-50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={member.avatarUrl}
                          name={member.displayName}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{member.displayName}</p>
                          <p className="text-xs text-gray-500">@{member.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {member.role === 'owner' ? (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-800 text-white">
                          Owner
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-200 text-gray-800">
                          {member.role === 'manager' ? 'Manager' : 'Member'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {member.role === 'owner' ? (
                        <span className="text-gray-500 text-xs">(Owner)</span>
                      ) : (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          disabled={deletingUserId === member.userId}
                          className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {deletingUserId === member.userId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger Zone - only for owner */}
      {isOwner && (
        <div className="border border-red-200 rounded-lg p-6 bg-white">
          <h2 className="text-2xl font-bold text-red-600 mb-6">Danger Zone</h2>
          <p className="text-sm text-gray-600 mb-4">
            Once you delete a group, there is no going back. Please be certain.
          </p>
          <button
            onClick={handleDeleteGroup}
            disabled={saving}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            ) : null}
            Delete Group
          </button>
        </div>
      )}
    </div>
  )
}
