# Account Management Features

## Overview

Added three new account management buttons to the Instagram Feed Manager dashboard.

## New Features

### 1. Switch Account Button

- **Location**: Account Connection card, below profile info
- **Functionality**: Opens Instagram OAuth window to connect a different account
- **Behavior**: Same as "Connect Instagram Account" but visible when already connected
- **Use Case**: Switching between different Instagram Business accounts

### 2. Delete Data Button

- **Location**: Account Connection card, below profile info
- **Style**: Critical tone (red)
- **Functionality**: Deletes all Instagram-related data from Shopify
- **Confirmation**: Requires user confirmation dialog
- **What it deletes**:
  - All `instagram-post` metaobjects
  - The `instagram-list` metaobject
  - All files with `instagram-post_` prefix
- **What it keeps**:
  - Instagram account connection in database
  - Ability to re-sync without reconnecting

### 3. Disconnect Account Button

- **Location**: Account Connection card, below profile info
- **Style**: Critical tone (red)
- **Functionality**: Complete disconnection and data cleanup
- **Confirmation**: Requires user confirmation dialog
- **What it does**:
  1. Calls delete endpoint to remove all Instagram data
  2. Removes the Instagram account from Prisma database
  3. User must reconnect to use the app again
- **Use Case**: Complete reset or switching to a different store

## Implementation Details

### Action Handler

```typescript
export const action = async ({ request }: ActionFunctionArgs) => {
  // Three action types: "sync", "delete-data", "disconnect"
  // delete-data: Calls /api/delete-instagram-data endpoint
  // disconnect: Calls delete endpoint + removes social account from DB
};
```

### UI Components

```tsx
<InlineStack gap="300" wrap={false}>
  <Button onClick={handleSwitchAccount} disabled={isSyncing}>
    Switch Account
  </Button>
  <Button onClick={handleDeleteData} tone="critical" disabled={isSyncing}>
    Delete Data
  </Button>
  <Button onClick={handleDisconnect} tone="critical" disabled={isSyncing}>
    Disconnect Account
  </Button>
</InlineStack>
```

### Confirmation Dialogs

Both destructive actions (Delete Data and Disconnect) show browser confirmation dialogs:

- **Delete Data**: "Are you sure you want to delete all Instagram posts, files, and metaobjects? This cannot be undone."
- **Disconnect**: "Are you sure you want to disconnect your Instagram account? This will delete all synced data and cannot be undone."

### State Management

- All buttons are disabled while sync is in progress (`isSyncing`)
- Uses Remix's `useSubmit` hook for form submission
- Navigation state tracked for loading indicators

## API Endpoints Used

### `/api/delete-instagram-data`

- Existing endpoint that removes all Instagram data
- Used by both "Delete Data" and "Disconnect Account" buttons
- Deletes metaobjects and files via Shopify GraphQL

### Database Operations

```typescript
// Only used by Disconnect Account
await prisma.socialAccount.delete({
  where: {
    shop_provider: {
      shop: session.shop,
      provider: "instagram",
    },
  },
});
```

## User Flow

### Switch Account Flow

1. User clicks "Switch Account"
2. Instagram OAuth window opens
3. User logs in with different Instagram account
4. New account replaces old connection
5. Existing data remains until manually deleted

### Delete Data Flow

1. User clicks "Delete Data"
2. Confirmation dialog appears
3. User confirms
4. All Instagram data deleted from Shopify
5. Account connection remains
6. User can re-sync without reconnecting

### Disconnect Account Flow

1. User clicks "Disconnect Account"
2. Confirmation dialog appears
3. User confirms
4. All Instagram data deleted from Shopify
5. Account connection removed from database
6. Dashboard returns to "Not Connected" state
7. User must reconnect to use app again

## Visual Design

### Button Layout

- Three buttons in a horizontal row
- Equal spacing between buttons
- Critical buttons (Delete, Disconnect) use red tone
- Switch Account uses default tone
- All buttons disabled during operations

### Placement

- Buttons appear after account info
- Separated by a divider line
- Only visible when account is connected
- Part of the Account Connection card

## Safety Features

1. **Confirmation Dialogs**: All destructive actions require confirmation
2. **Disabled State**: Buttons disabled during operations to prevent double-submission
3. **Error Handling**: Try-catch blocks with user-friendly error messages
4. **Sequential Operations**: Disconnect calls delete first, then removes account

## Error Messages

### Success Messages

- Delete Data: "All Instagram data deleted successfully!"
- Disconnect: "Instagram account disconnected and all data deleted!"

### Error Messages

- Delete Data: "Delete failed. Please try again."
- Disconnect: "Disconnect failed. Please try again."
