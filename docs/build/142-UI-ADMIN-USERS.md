# Build 142: Admin Users Management Page UI

## Goal
Create the `/admin/users` page with a searchable, sortable user table, inline quick actions (suspend/activate buttons), and click-to-view detailed user information. Provides the main admin interface for user management.

---

## Spec Extract

**Route:**
```
GET /admin/users
```

**Features:**
- Searchable table (username, email)
- Sortable columns (username, created date, last login)
- Pagination controls
- Status filtering (active, suspended, pending)
- Quick action buttons (suspend, activate)
- Click row to view/edit user details
- Display columns: username, email, status, artworks, created date, actions

**Responsive Design:**
- Desktop: Full table view
- Tablet: Hide secondary columns, keep essential columns
- Mobile: Single card view per user with actions

---

## Prerequisites

**Must complete before starting:**
- **137-API-ADMIN-USERS-LIST.md** - API for user list
- **138-API-ADMIN-USERS-GET.md** - API for user details
- **140-API-ADMIN-USERS-SUSPEND.md** - API for suspension
- **141-API-ADMIN-USERS-ACTIVATE.md** - API for activation

**Reason:** UI depends on these APIs being available.

---

## Steps

### Step 1: Create Admin Users Hook

Create a React hook for managing user list state and API calls.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useAdminUsers.ts`

```typescript
/**
 * Hook for managing admin users list state and operations
 */

import { useState, useCallback, useEffect } from 'react';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  status: string;
  role: string;
  artworkCount: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface UsersListState {
  users: AdminUser[];
  loading: boolean;
  error: string | null;
  page: number;
  limit: number;
  total: number;
  search: string;
  status: string;
  sort: string;
  order: string;
}

const initialState: UsersListState = {
  users: [],
  loading: false,
  error: null,
  page: 1,
  limit: 20,
  total: 0,
  search: '',
  status: '',
  sort: 'created_at',
  order: 'desc',
};

/**
 * Hook for managing admin users
 */
export function useAdminUsers() {
  const [state, setState] = useState<UsersListState>(initialState);

  /**
   * Fetch users list
   */
  const fetchUsers = useCallback(async (overrides: Partial<UsersListState> = {}) => {
    const queryState = { ...state, ...overrides };

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams();
      params.append('page', queryState.page.toString());
      params.append('limit', queryState.limit.toString());

      if (queryState.search) {
        params.append('search', queryState.search);
      }
      if (queryState.status) {
        params.append('status', queryState.status);
      }
      if (queryState.sort) {
        params.append('sort', queryState.sort);
      }
      if (queryState.order) {
        params.append('order', queryState.order);
      }

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();

      setState({
        ...queryState,
        users: data.users,
        total: data.pagination.total,
        loading: false,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [state]);

  /**
   * Update search and reset to first page
   */
  const setSearch = useCallback(
    (search: string) => {
      fetchUsers({ ...state, search, page: 1 });
    },
    [state, fetchUsers]
  );

  /**
   * Update status filter and reset to first page
   */
  const setStatusFilter = useCallback(
    (status: string) => {
      fetchUsers({ ...state, status, page: 1 });
    },
    [state, fetchUsers]
  );

  /**
   * Change page
   */
  const setPage = useCallback(
    (page: number) => {
      fetchUsers({ ...state, page });
    },
    [state, fetchUsers]
  );

  /**
   * Change sort
   */
  const setSort = useCallback(
    (sort: string, order?: string) => {
      fetchUsers({ ...state, sort, order: order || 'desc', page: 1 });
    },
    [state, fetchUsers]
  );

  /**
   * Suspend user
   */
  const suspendUser = useCallback(
    async (userId: string, reason?: string) => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/suspend`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
          throw new Error('Failed to suspend user');
        }

        // Refresh users list
        await fetchUsers();
        return true;
      } catch (error) {
        console.error('Suspend user error:', error);
        return false;
      }
    },
    [fetchUsers]
  );

  /**
   * Activate user
   */
  const activateUser = useCallback(
    async (userId: string, reason?: string) => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/activate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        });

        if (!response.ok) {
          throw new Error('Failed to activate user');
        }

        // Refresh users list
        await fetchUsers();
        return true;
      } catch (error) {
        console.error('Activate user error:', error);
        return false;
      }
    },
    [fetchUsers]
  );

  return {
    ...state,
    fetchUsers,
    setSearch,
    setStatusFilter,
    setPage,
    setSort,
    suspendUser,
    activateUser,
  };
}
```

---

### Step 2: Create Admin Users Table Component

Create a reusable table component for displaying users.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/AdminUsersTable.tsx`

```typescript
/**
 * Admin users table component with search, sort, and pagination
 */

import React, { useState } from 'react';
import { AdminUser } from '../../hooks/useAdminUsers';
import styles from './AdminUsersTable.module.css';

interface Props {
  users: AdminUser[];
  loading: boolean;
  page: number;
  total: number;
  limit: number;
  search: string;
  status: string;
  sort: string;
  order: string;
  onSearch: (search: string) => void;
  onStatusFilter: (status: string) => void;
  onSort: (sort: string, order?: string) => void;
  onPageChange: (page: number) => void;
  onRowClick: (userId: string) => void;
  onSuspend: (userId: string) => void;
  onActivate: (userId: string) => void;
}

/**
 * Format date for display
 */
function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get status badge color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'green';
    case 'pending':
      return 'yellow';
    case 'suspended':
      return 'red';
    case 'deleted':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * AdminUsersTable component
 */
export const AdminUsersTable: React.FC<Props> = ({
  users,
  loading,
  page,
  total,
  limit,
  search,
  status,
  sort,
  order,
  onSearch,
  onStatusFilter,
  onSort,
  onPageChange,
  onRowClick,
  onSuspend,
  onActivate,
}) => {
  const [searchInput, setSearchInput] = useState(search);
  const totalPages = Math.ceil(total / limit);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
  };

  const toggleSort = (field: string) => {
    if (sort === field) {
      onSort(field, order === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(field, 'asc');
    }
  };

  const getSortIndicator = (field: string) => {
    if (sort !== field) return ' ↕';
    return order === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className={styles.container}>
      {/* Search and Filter Bar */}
      <div className={styles.toolbar}>
        <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton}>
            Search
          </button>
        </form>

        <select
          value={status}
          onChange={(e) => onStatusFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => toggleSort('username')} className={styles.sortable}>
                Username {getSortIndicator('username')}
              </th>
              <th>Email</th>
              <th>Status</th>
              <th className={styles.numeric}>Artworks</th>
              <th onClick={() => toggleSort('created_at')} className={styles.sortable}>
                Created {getSortIndicator('created_at')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className={styles.loading}>
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} onClick={() => onRowClick(user.id)} className={styles.row}>
                  <td className={styles.username}>
                    <strong>{user.username}</strong>
                  </td>
                  <td className={styles.email}>{user.email}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[`badge-${getStatusColor(user.status)}`]}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className={styles.numeric}>{user.artworkCount}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td className={styles.actions} onClick={(e) => e.stopPropagation()}>
                    {user.status === 'suspended' ? (
                      <button
                        onClick={() => onActivate(user.id)}
                        className={`${styles.actionButton} ${styles.activate}`}
                        title="Activate user"
                      >
                        Activate
                      </button>
                    ) : user.status === 'active' ? (
                      <button
                        onClick={() => onSuspend(user.id)}
                        className={`${styles.actionButton} ${styles.suspend}`}
                        title="Suspend user"
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        onClick={() => onActivate(user.id)}
                        className={`${styles.actionButton} ${styles.activate}`}
                        title="Activate user"
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className={styles.pagination}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={styles.paginationButton}
        >
          ← Previous
        </button>

        <span className={styles.pageInfo}>
          Page {page} of {totalPages} (showing {users.length} of {total})
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={styles.paginationButton}
        >
          Next →
        </button>
      </div>
    </div>
  );
};
```

---

### Step 3: Create Admin Users Page Component

Create the main admin users page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/AdminUsersPage.tsx`

```typescript
/**
 * Admin users management page
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { AdminUsersTable } from '../../components/admin/AdminUsersTable';
import { UserDetailModal } from '../../components/admin/UserDetailModal';
import styles from './AdminUsersPage.module.css';

/**
 * Admin Users Page
 */
export const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    users,
    loading,
    error,
    page,
    limit,
    total,
    search,
    status,
    sort,
    order,
    fetchUsers,
    setSearch,
    setStatusFilter,
    setPage,
    setSort,
    suspendUser,
    activateUser,
  } = useAdminUsers();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  /**
   * Fetch users on mount
   */
  useEffect(() => {
    fetchUsers();
  }, []);

  /**
   * Handle row click to show user details
   */
  const handleRowClick = (userId: string) => {
    setSelectedUserId(userId);
    setShowDetailModal(true);
  };

  /**
   * Handle suspend action
   */
  const handleSuspend = async (userId: string) => {
    if (window.confirm('Are you sure you want to suspend this user?')) {
      const success = await suspendUser(userId, 'Suspended by admin');
      if (success) {
        alert('User suspended successfully');
        setShowDetailModal(false);
      } else {
        alert('Failed to suspend user');
      }
    }
  };

  /**
   * Handle activate action
   */
  const handleActivate = async (userId: string) => {
    if (window.confirm('Are you sure you want to activate this user?')) {
      const success = await activateUser(userId, 'Activated by admin');
      if (success) {
        alert('User activated successfully');
        setShowDetailModal(false);
      } else {
        alert('Failed to activate user');
      }
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>User Management</h1>
        <p>Manage user accounts, status, and permissions</p>
      </header>

      {error && (
        <div className={styles.error}>
          <p>Error: {error}</p>
          <button onClick={() => fetchUsers()}>Try Again</button>
        </div>
      )}

      <AdminUsersTable
        users={users}
        loading={loading}
        page={page}
        total={total}
        limit={limit}
        search={search}
        status={status}
        sort={sort}
        order={order}
        onSearch={setSearch}
        onStatusFilter={setStatusFilter}
        onSort={setSort}
        onPageChange={setPage}
        onRowClick={handleRowClick}
        onSuspend={handleSuspend}
        onActivate={handleActivate}
      />

      {showDetailModal && selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setShowDetailModal(false)}
          onSuspend={handleSuspend}
          onActivate={handleActivate}
        />
      )}
    </div>
  );
};

export default AdminUsersPage;
```

---

### Step 4: Create User Detail Modal Component

Create a modal for viewing and editing user details.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/UserDetailModal.tsx`

```typescript
/**
 * User detail modal for viewing and taking actions
 */

import React, { useEffect, useState } from 'react';
import styles from './UserDetailModal.module.css';

interface DetailedUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  status: string;
  role: string;
  galleries: number;
  collections: number;
  artworks: number;
  galleryLimit: number;
  collectionLimit: number;
  artworkLimit: number;
  dailyUploadLimit: number;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  activity: {
    logins: number;
    lastActivity: string | null;
    uploads: number;
    messages: number;
  };
}

interface Props {
  userId: string;
  onClose: () => void;
  onSuspend: (userId: string) => void;
  onActivate: (userId: string) => void;
}

/**
 * UserDetailModal component
 */
export const UserDetailModal: React.FC<Props> = ({
  userId,
  onClose,
  onSuspend,
  onActivate,
}) => {
  const [user, setUser] = useState<DetailedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch user details
   */
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/users/${userId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }

        const data = await response.json();
        setUser(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  if (loading) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.loading}>Loading user details...</div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.error}>
            <h3>Error</h3>
            <p>{error || 'User not found'}</p>
            <button onClick={onClose} className={styles.closeButton}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isActive = user.status === 'active';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2>{user.username}</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        </header>

        <div className={styles.content}>
          {/* Profile Section */}
          <section className={styles.section}>
            <h3>Profile</h3>
            <div className={styles.grid}>
              <div>
                <label>Email</label>
                <p>{user.email}</p>
              </div>
              <div>
                <label>Display Name</label>
                <p>{user.displayName || '—'}</p>
              </div>
              <div>
                <label>Status</label>
                <p className={styles[`status-${user.status}`]}>
                  {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                </p>
              </div>
              <div>
                <label>Role</label>
                <p>{user.role}</p>
              </div>
              <div>
                <label>Email Verified</label>
                <p>{user.emailVerifiedAt ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </section>

          {/* Resources Section */}
          <section className={styles.section}>
            <h3>Resources</h3>
            <div className={styles.grid}>
              <div>
                <label>Galleries</label>
                <p>{user.galleries} / {user.galleryLimit}</p>
              </div>
              <div>
                <label>Collections</label>
                <p>{user.collections} / {user.collectionLimit}</p>
              </div>
              <div>
                <label>Artworks</label>
                <p>{user.artworks} / {user.artworkLimit}</p>
              </div>
              <div>
                <label>Daily Upload Limit</label>
                <p>{user.dailyUploadLimit} items/day</p>
              </div>
            </div>
          </section>

          {/* Activity Section */}
          <section className={styles.section}>
            <h3>Activity</h3>
            <div className={styles.grid}>
              <div>
                <label>Uploads (30d)</label>
                <p>{user.activity.uploads}</p>
              </div>
              <div>
                <label>Messages</label>
                <p>{user.activity.messages}</p>
              </div>
              <div>
                <label>Last Activity</label>
                <p>
                  {user.activity.lastActivity
                    ? new Date(user.activity.lastActivity).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
              <div>
                <label>Last Login</label>
                <p>
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </section>

          {/* Dates Section */}
          <section className={styles.section}>
            <h3>Account Dates</h3>
            <div className={styles.grid}>
              <div>
                <label>Created</label>
                <p>{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <label>Last Updated</label>
                <p>{new Date(user.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Actions */}
        <footer className={styles.footer}>
          {isActive ? (
            <button
              onClick={() => onSuspend(user.id)}
              className={`${styles.actionButton} ${styles.suspend}`}
            >
              Suspend User
            </button>
          ) : (
            <button
              onClick={() => onActivate(user.id)}
              className={`${styles.actionButton} ${styles.activate}`}
            >
              Activate User
            </button>
          )}
          <button onClick={onClose} className={styles.closeButton}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};
```

---

### Step 5: Create CSS Module

Create styles for the components.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/AdminUsersTable.module.css`

```css
.container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

.toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.searchForm {
  display: flex;
  gap: 10px;
  flex: 1;
  min-width: 300px;
}

.searchInput {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.searchButton {
  padding: 10px 20px;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.searchButton:hover {
  background: #0052a3;
}

.filterSelect {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.tableWrapper {
  overflow-x: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table thead {
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
}

.table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #333;
}

.sortable {
  cursor: pointer;
  user-select: none;
}

.sortable:hover {
  background: #efefef;
}

.table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.table tbody tr:hover {
  background: #f9f9f9;
  cursor: pointer;
}

.username {
  font-weight: 500;
  color: #0066cc;
}

.email {
  color: #666;
  font-size: 13px;
}

.numeric {
  text-align: right;
}

.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.badge-green {
  background: #d4edda;
  color: #155724;
}

.badge-yellow {
  background: #fff3cd;
  color: #856404;
}

.badge-red {
  background: #f8d7da;
  color: #721c24;
}

.badge-gray {
  background: #e2e3e5;
  color: #383d41;
}

.actions {
  text-align: right;
}

.actionButton {
  padding: 6px 12px;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.actionButton.suspend {
  background: #f8d7da;
  color: #721c24;
}

.actionButton.suspend:hover {
  background: #f5c6cb;
}

.actionButton.activate {
  background: #d4edda;
  color: #155724;
}

.actionButton.activate:hover {
  background: #c3e6cb;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  padding: 20px 0;
}

.paginationButton {
  padding: 10px 15px;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.paginationButton:hover:not(:disabled) {
  background: #0052a3;
}

.paginationButton:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.pageInfo {
  color: #666;
  font-size: 14px;
}

.loading,
.empty {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

@media (max-width: 768px) {
  .email {
    display: none;
  }

  .sortable {
    pointer-events: none;
  }

  .actionButton {
    font-size: 11px;
    padding: 4px 8px;
  }
}
```

---

### Step 6: Create Page CSS

Create styles for the admin users page.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/AdminUsersPage.module.css`

```css
.page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  margin-bottom: 30px;
}

.header h1 {
  font-size: 32px;
  margin: 0 0 10px 0;
}

.header p {
  color: #666;
  margin: 0;
}

.error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 20px;
  color: #721c24;
}

.error button {
  margin-top: 10px;
  padding: 8px 16px;
  background: #721c24;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.error button:hover {
  background: #6c1b22;
}
```

---

### Step 7: Create Modal CSS

Create styles for the user detail modal.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/UserDetailModal.module.css`

```css
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.header h2 {
  margin: 0;
  font-size: 24px;
}

.closeButton {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.closeButton:hover {
  color: #333;
}

.content {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  border-bottom: 1px solid #eee;
  padding-bottom: 20px;
}

.section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.grid > div {
  display: flex;
  flex-direction: column;
}

.grid label {
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 5px;
  font-weight: 600;
}

.grid p {
  margin: 0;
  font-size: 14px;
  color: #333;
}

.status-active {
  color: #155724;
  font-weight: 600;
}

.status-suspended {
  color: #721c24;
  font-weight: 600;
}

.status-pending {
  color: #856404;
  font-weight: 600;
}

.footer {
  display: flex;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #eee;
  justify-content: flex-end;
}

.actionButton {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.actionButton.suspend {
  background: #dc3545;
  color: white;
}

.actionButton.suspend:hover {
  background: #c82333;
}

.actionButton.activate {
  background: #28a745;
  color: white;
}

.actionButton.activate:hover {
  background: #218838;
}

.loading,
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #666;
}

@media (max-width: 600px) {
  .modal {
    width: 95%;
    max-height: 95vh;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .footer {
    flex-direction: column;
  }

  .actionButton {
    width: 100%;
  }
}
```

---

### Step 8: Register Route

Add the admin users page route to your router.

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/index.tsx` (or wherever routes are defined)

```typescript
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';

// Add to routes array:
{
  path: '/admin/users',
  element: <AdminUsersPage />,
  requiredRole: 'admin',
}
```

---

## Files to Create/Modify

**New files to create:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/hooks/useAdminUsers.ts`
2. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/AdminUsersTable.tsx`
3. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/AdminUsersTable.module.css`
4. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/UserDetailModal.tsx`
5. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/admin/UserDetailModal.module.css`
6. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/AdminUsersPage.tsx`
7. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/admin/AdminUsersPage.module.css`

**Modified files:**
1. `/Volumes/DataSSD/gitsrc/vfa_gallery/src/routes/index.tsx` - Add admin users route

---

## Verification

### Test 1: Page Load

Navigate to `/admin/users` and verify:
- [ ] Page loads without errors
- [ ] Users table displays with sample data
- [ ] Search and filter controls visible
- [ ] Pagination controls visible

---

### Test 2: Search Functionality

Type in search box and submit:
- [ ] Results filter by username/email
- [ ] Page resets to 1
- [ ] Count updates

---

### Test 3: Status Filter

Select a status filter:
- [ ] Only users with that status display
- [ ] Count updates
- [ ] Page resets to 1

---

### Test 4: Sorting

Click column headers:
- [ ] Users sort by that field
- [ ] Sort indicator shows direction
- [ ] Toggle between asc/desc

---

### Test 5: Click Row

Click a user row:
- [ ] Detail modal opens
- [ ] User information displays
- [ ] Activity metrics visible

---

### Test 6: Suspend Action

From table row or modal, click Suspend:
- [ ] Confirmation dialog appears
- [ ] User status changes to suspended
- [ ] Table updates automatically
- [ ] Modal closes on success

---

### Test 7: Activate Action

For suspended user, click Activate:
- [ ] Confirmation dialog appears
- [ ] User status changes to active
- [ ] Table updates automatically

---

### Test 8: Responsive Design

Test on mobile/tablet:
- [ ] Table is scrollable or single-card view
- [ ] Buttons still accessible
- [ ] Modal is readable

---

## Summary

This build creates a professional admin user management interface with:
- Searchable, sortable, paginated user table
- Multiple filter options (status, search)
- Quick-action buttons for suspend/activate
- Detailed user information modal
- Activity metrics and resource tracking
- Responsive design for mobile/tablet/desktop
- Full integration with admin API endpoints

---

**Next step:** Proceed to **143-API-ADMIN-MESSAGES-PENDING.md** to create the message moderation API.
