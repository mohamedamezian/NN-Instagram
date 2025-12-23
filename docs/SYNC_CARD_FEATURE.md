# Dedicated Sync Card Feature

## Overview

Created a dedicated sync card that shows real-time progress and status when syncing Instagram posts.

## New Features

### 1. **Dedicated Manual Sync Card**

- **Placement**: First card when account is connected (above Account Connection)
- **Purpose**: Clear, prominent sync controls with progress feedback
- **Design**: Clean layout with description and action button

### 2. **Real-Time Sync Progress**

Shows live sync status with:

- **Progress Bar**: Visual 0-100% progress indicator
- **Status Messages**: Text describing current operation
- **Spinner Icon**: Animated loading indicator
- **Auto-reload**: Page refreshes after successful sync

### 3. **Progress Stages**

The sync shows these stages:

1. "Connecting to Instagram..." (10%)
2. "Fetching Instagram posts..." (30%)
3. "Uploading media files to Shopify..." (60%)
4. "Creating metaobjects..." (80%)
5. "Sync completed successfully!" (100%)

### 4. **Last Sync Time Display**

- Shows when account was last synced
- Relative time format ("5 minutes ago", "2 hours ago")
- Displays when NOT syncing
- Uses calendar icon for visual clarity

## UI Components

### Card Layout

```tsx
┌─────────────────────────────────────────┐
│ Manual Sync              [Sync Now →]   │
│ Fetch the latest posts...               │
├─────────────────────────────────────────┤
│ ● Connecting to Instagram...            │
│ ▓▓▓▓▓░░░░░░░░░ 10%                      │
├─────────────────────────────────────────┤
│ 📅 Last synced 5 minutes ago            │
└─────────────────────────────────────────┘
```

### States

#### Idle State (Not Syncing)

- Shows "Sync Now" button (enabled)
- Displays last sync time
- No progress indicators

#### Syncing State

- "Sync Now" button shows loading
- Progress bar visible
- Status message updates
- Spinner icon animates
- All action buttons disabled

#### Success State

- Shows "Sync completed successfully!"
- Progress bar at 100%
- Page auto-reloads after 1.5 seconds

#### Error State

- Shows "Sync failed. Please try again."
- Returns to idle state after 2 seconds
- Button re-enabled

## Technical Implementation

### State Management

```typescript
const [isSyncing, setIsSyncing] = useState(false);
const [syncStatus, setSyncStatus] = useState<string>("");
const [syncProgress, setSyncProgress] = useState(0);
```

### Sync Handler

```typescript
const handleSync = async () => {
  setIsSyncing(true);
  setSyncStatus("Connecting to Instagram...");
  setSyncProgress(10);

  const response = await fetch("/api/instagram/staged-upload");

  // Update progress through stages
  // Auto-reload on success
  // Show error and reset on failure
};
```

### Progress Simulation

Currently uses `setTimeout` to simulate progress stages. In production, this could be replaced with:

- Server-Sent Events (SSE)
- WebSocket connection
- Polling endpoint for real progress
- Reading from log files

## Button States

All action buttons respect sync state:

- **Switch Account**: Disabled during sync
- **Delete Data**: Disabled during sync
- **Disconnect Account**: Disabled during sync
- **Sync Now**: Shows loading during sync

## Layout Changes

### Before

```
Page (with Primary Action button in header)
├── Account Connection Card
├── Sync Status Card (with last sync time)
└── Statistics Card
```

### After

```
Page (clean header, no primary action)
├── Manual Sync Card ⭐ NEW
│   ├── Sync button
│   ├── Progress indicators (when syncing)
│   └── Last sync time (when idle)
├── Account Connection Card
├── Sync Statistics Card (renamed)
└── Info Banner
```

## User Experience Improvements

1. **Clearer Action**: Dedicated card makes sync action more discoverable
2. **Progress Visibility**: Users see what's happening during sync
3. **Reduced Anxiety**: Progress bar and status messages provide feedback
4. **Better Organization**: Sync controls separated from statistics
5. **Professional Feel**: Loading states and animations feel polished

## API Integration

- Calls `/api/instagram/staged-upload` endpoint directly
- GET request (no form submission needed)
- Async/await for cleaner error handling
- Automatic page refresh on completion

## Future Enhancements

- Real-time progress from server (SSE/WebSocket)
- Show number of posts being processed
- Detailed error messages
- Ability to cancel sync
- Sync history/logs viewer
- Notification when sync completes
