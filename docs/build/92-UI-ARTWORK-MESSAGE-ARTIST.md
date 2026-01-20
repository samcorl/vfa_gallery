# Build 92: Message Artist Button

## Goal

Create a "Message Artist" button component for the artwork detail page that allows logged-in users to send direct messages to artwork creators with pre-filled context about the artwork. Button only displays when viewing another user's artwork while logged in.

---

## Spec Extract

**Features:**
- Only visible when user is logged in
- Hidden when viewing own artwork
- Links to message compose page with artwork context pre-filled
- Shows artist name and avatar in context
- Integrates with existing messaging system
- Responsive button styling

**Behavior:**
- Not logged in: Button not visible
- Viewing own artwork: Button not visible (conditionally hidden)
- Viewing another user's artwork while logged in: Button visible
- Click button: Navigates to message compose with artwork pre-filled
- Message context includes: artwork URL, title, artist name

---

## Prerequisites

**Must complete before starting:**
- **89-UI-PUBLIC-ARTWORK.md** - Artwork detail page
- **25-REACT-AUTH-CONTEXT.md** - Auth context and useAuth hook
- **12-SCHEMA-MESSAGES.md** or equivalent - Messages table schema exists
- **Messaging UI** - Message compose page already created and routable

**Reason:** Component needs auth context to check if user is logged in and viewing own artwork. Navigation to compose page requires existing routes.

---

## Steps

### Step 1: Create Message Context Types

Create types for messaging context:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/message.ts`

```typescript
export interface MessageArtworkContext {
  artworkUrl: string;
  artworkTitle: string;
  artworkImageUrl: string;
}

export interface MessageComposePrefill {
  recipientUsername: string;
  artworkContext?: MessageArtworkContext;
}

export interface ArtworkContextState {
  artworkContext?: {
    url: string;
    title: string;
    imageUrl: string;
  };
}
```

### Step 2: Create Message Compose Context

Create a context for passing message prefill data to the compose page:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/context/MessageContext.tsx`

```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { MessageComposePrefill } from '../types/message';

interface MessageContextType {
  prefill: MessageComposePrefill | null;
  setPrefill: (prefill: MessageComposePrefill | null) => void;
  clearPrefill: () => void;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export function MessageProvider({ children }: { children: ReactNode }) {
  const [prefill, setPrefill] = useState<MessageComposePrefill | null>(null);

  const clearPrefill = () => {
    setPrefill(null);
  };

  return (
    <MessageContext.Provider value={{ prefill, setPrefill, clearPrefill }}>
      {children}
    </MessageContext.Provider>
  );
}

export function useMessageContext() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessageContext must be used within MessageProvider');
  }
  return context;
}
```

### Step 3: Update App.tsx with Message Provider

Add the MessageProvider to your app's context providers:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

```typescript
import { MessageProvider } from './context/MessageContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MessageProvider>
          {/* Your app routes */}
        </MessageProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
```

### Step 4: Create Message Artist Button Component

Create the message button component:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkMessageButton.tsx`

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useMessageContext } from '../../context/MessageContext';
import type { PublicArtworkResponse } from '../../types/public';

interface ArtworkMessageButtonProps {
  artwork: PublicArtworkResponse;
}

export default function ArtworkMessageButton({ artwork }: ArtworkMessageButtonProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { setPrefill } = useMessageContext();

  // Don't show if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Don't show if viewing own artwork
  if (user.id === artwork.artist.id) {
    return null;
  }

  const handleMessageArtist = () => {
    // Set prefill data with artwork context
    setPrefill({
      recipientUsername: artwork.artist.username,
      artworkContext: {
        artworkUrl: window.location.href,
        artworkTitle: artwork.title,
        artworkImageUrl: artwork.displayUrl,
      },
    });

    // Navigate to message compose page
    navigate('/messages/compose', {
      state: {
        recipientUsername: artwork.artist.username,
        artworkContext: {
          url: window.location.href,
          title: artwork.title,
          imageUrl: artwork.displayUrl,
        },
      },
    });
  };

  return (
    <button
      onClick={handleMessageArtist}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
      title={`Send a message to ${artwork.artist.displayName || artwork.artist.username}`}
      aria-label={`Message ${artwork.artist.displayName || artwork.artist.username}`}
    >
      <PaperAirplaneIcon className="w-5 h-5" />
      <span>Message Artist</span>
    </button>
  );
}
```

### Step 5: Update Artwork Metadata Sidebar

Add the message button to the metadata sidebar:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkMetadata.tsx`

Add the import at the top:

```typescript
import ArtworkMessageButton from './ArtworkMessageButton';
```

Then add the message button section in the metadata sidebar:

```typescript
import React from 'react';
import { Link } from 'react-router-dom';
import type { PublicArtworkResponse } from '../../types/public';
import ArtworkShare from './ArtworkShare';
import ArtworkMessageButton from './ArtworkMessageButton';

interface ArtworkMetadataProps {
  artwork: PublicArtworkResponse;
}

export default function ArtworkMetadata({ artwork }: ArtworkMetadataProps) {
  const uploadDate = new Date(artwork.metadata.uploadedAt).toLocaleDateString(
    'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <div className="space-y-6">
      {/* Message Artist Button */}
      <div>
        <ArtworkMessageButton artwork={artwork} />
      </div>

      {/* Artist Credit */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Artist
        </h3>
        <Link
          to={`/${artwork.artist.username}`}
          className="flex items-center space-x-3 hover:opacity-70 transition-opacity"
        >
          {artwork.artist.avatarUrl && (
            <img
              src={artwork.artist.avatarUrl}
              alt={artwork.artist.username}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {artwork.artist.displayName || artwork.artist.username}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              @{artwork.artist.username}
            </p>
          </div>
        </Link>
      </div>

      {/* Image Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Image Info
        </h3>
        <div className="space-y-2 text-sm">
          {artwork.metadata.width && artwork.metadata.height && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Dimensions:</span>
              <span className="text-gray-900 dark:text-white font-mono">
                {artwork.metadata.width} × {artwork.metadata.height}
              </span>
            </div>
          )}
          {artwork.metadata.mimeType && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="text-gray-900 dark:text-white font-mono uppercase text-xs">
                {artwork.metadata.mimeType.split('/')[1]}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Uploaded:</span>
            <span className="text-gray-900 dark:text-white text-xs">{uploadDate}</span>
          </div>
        </div>
      </div>

      {/* Collection Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Collection
        </h3>
        <Link
          to={`/${artwork.artist.username}/${artwork.parent.gallery.slug}/${artwork.parent.collection.slug}`}
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
        >
          {artwork.parent.collection.name}
        </Link>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          in {artwork.parent.gallery.name}
        </p>
      </div>

      {/* Share Buttons */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase mb-3">
          Share
        </h3>
        <ArtworkShare
          artworkUrl={window.location.href}
          artworkTitle={artwork.title}
          artworkDescription={artwork.description}
          artworkImageUrl={artwork.displayUrl}
        />
      </div>
    </div>
  );
}
```

### Step 6: Create Message Compose Page Integration

Ensure your message compose page uses the prefill data:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/MessageComposePage.tsx` (if not already created, create a basic version)

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMessageContext } from '../context/MessageContext';
import type { MessageArtworkContext } from '../types/message';

interface LocationState {
  recipientUsername?: string;
  artworkContext?: MessageArtworkContext;
}

export default function MessageComposePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { prefill, clearPrefill } = useMessageContext();

  const [recipient, setRecipient] = useState<string>('');
  const [messageBody, setMessageBody] = useState<string>('');
  const [artworkContext, setArtworkContext] = useState<MessageArtworkContext | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Load prefill data from context or location state
  useEffect(() => {
    const state = location.state as LocationState | undefined;

    if (prefill) {
      setRecipient(prefill.recipientUsername);
      if (prefill.artworkContext) {
        setArtworkContext(prefill.artworkContext);
        // Pre-populate message with artwork context
        const contextMessage = `I wanted to discuss your artwork: "${prefill.artworkContext.artworkTitle}"\n\n${prefill.artworkContext.artworkUrl}\n\n`;
        setMessageBody(contextMessage);
      }
      clearPrefill();
    } else if (state?.recipientUsername) {
      setRecipient(state.recipientUsername);
      if (state.artworkContext) {
        setArtworkContext(state.artworkContext);
        const contextMessage = `I wanted to discuss your artwork: "${state.artworkContext.artworkTitle}"\n\n${state.artworkContext.artworkUrl}\n\n`;
        setMessageBody(contextMessage);
      }
    }
  }, [prefill, location.state, clearPrefill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipient.trim()) {
      setError('Please enter a recipient username');
      return;
    }

    if (!messageBody.trim()) {
      setError('Please enter a message');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          recipientUsername: recipient,
          body: messageBody,
          artworkContext: artworkContext ? {
            artworkUrl: artworkContext.artworkUrl,
            artworkTitle: artworkContext.artworkTitle,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      // Navigate to messages/inbox after successful send
      navigate('/messages/inbox');
    } catch (err) {
      console.error('Error sending message:', err);
      setError((err as Error).message || 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated || !user) {
    return null; // Will redirect above
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Send Message
        </h1>

        {/* Artwork Context Preview */}
        {artworkContext && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              About artwork
            </h3>
            <div className="flex gap-3">
              {artworkContext.artworkImageUrl && (
                <img
                  src={artworkContext.artworkImageUrl}
                  alt={artworkContext.artworkTitle}
                  className="w-12 h-12 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-blue-900 dark:text-blue-100 truncate">
                  {artworkContext.artworkTitle}
                </p>
                <a
                  href={artworkContext.artworkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
                >
                  View artwork
                </a>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient */}
          <div>
            <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To
            </label>
            <input
              id="recipient"
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="@username"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Message Body */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message
            </label>
            <textarea
              id="message"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Type your message..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              disabled={isLoading || !recipient.trim() || !messageBody.trim()}
            >
              {isLoading ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### Step 7: Update App Routes

Ensure the message compose route exists:

**File:** `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx`

Add the route:

```typescript
import MessageComposePage from './pages/MessageComposePage';

// In your routes:
{
  path: '/messages/compose',
  element: <MessageComposePage />,
}
```

---

## Files to Create/Modify

**Create:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/types/message.ts` - Message context types
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/context/MessageContext.tsx` - Message context provider
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkMessageButton.tsx` - Message button component
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/pages/MessageComposePage.tsx` - Message compose page (if not already exists)

**Modify:**
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/App.tsx` - Add MessageProvider and route
- `/Volumes/DataSSD/gitsrc/vfa_gallery/src/components/public/ArtworkMetadata.tsx` - Add message button to sidebar

---

## Verification

### Test 1: Not Logged In

- Not logged in, visit artwork detail page
- "Message Artist" button not visible
- Only Share section visible

### Test 2: Viewing Own Artwork (Logged In)

- Log in as artist
- View own artwork
- "Message Artist" button not visible
- Share buttons visible

### Test 3: Viewing Another's Artwork (Logged In)

- Log in as user A
- Visit user B's artwork
- "Message Artist" button visible
- Button shows "Message Artist"

### Test 4: Click Message Button

- Click "Message Artist" button
- Navigate to /messages/compose
- Recipient field pre-filled with artist username
- Message body pre-filled with artwork context
- Artwork preview shows in context box

### Test 5: Artwork Context Display

- On message compose page with artwork context
- Artwork thumbnail visible
- Artwork title displays
- "View artwork" link works
- Can edit message but context remains

### Test 6: Send Message

- Fill in message compose form
- Click "Send Message"
- Message sent successfully
- Redirect to /messages/inbox

### Test 7: Responsive Button

- Desktop: Full width button with icon and text
- Mobile: Button stacks with other elements properly
- Dark mode: Purple button with proper contrast

### Test 8: Multiple Artists

- Message artist A from their artwork
- Go back, message artist B
- Each has different pre-filled recipient
- Contexts are different for each artwork

### Test 9: Message Button Disabled

- Try to click button multiple times rapidly
- Only one request sent
- Loading state shows

### Test 10: User Not Found

- Try to message non-existent user
- Error message displays
- Can edit and retry

---

## Success Criteria

- [ ] Message button component created
- [ ] Button hidden when not logged in
- [ ] Button hidden when viewing own artwork
- [ ] Button visible when viewing another's artwork while logged in
- [ ] Message context passed correctly to compose page
- [ ] Artwork context pre-fills message body
- [ ] Message sending works with artwork reference
- [ ] Navigation to compose page works
- [ ] Responsive design on mobile and desktop
- [ ] Dark mode styling works
- [ ] All 10 test cases pass

---

## Next Steps

After verification, the artwork detail page is feature-complete with:
- Display (Build 89)
- Zoom viewer (Build 90)
- Share buttons (Build 91)
- Message artist (Build 92)

Future builds can extend with additional features like:
- Comments/reactions on artwork
- Artwork collections/favorites
- Related/similar artwork recommendations
