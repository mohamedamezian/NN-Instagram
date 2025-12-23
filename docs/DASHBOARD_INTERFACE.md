# Instagram Feed Manager Dashboard

## Overview

A comprehensive dashboard interface for managing Instagram feed synchronization with Shopify.

## Features Implemented

### 1. Account Connection Status

- **Visual Status Badge**: Shows "Connected" (green) or "Not Connected" (orange)
- **Instagram Profile Display**:
  - Profile picture thumbnail (when available)
  - Username with Instagram icon (@username)
  - User ID
  - Connection timestamp with relative time display ("X days ago")
- **Connect Button**: Opens Instagram OAuth flow in popup window

### 2. Sync Statistics Dashboard

Three informative stat cards displaying:

#### Posts Synced

- Shows total number of Instagram posts synchronized
- Direct link to Shopify Admin → Content → Metaobjects → instagram-post
- Instagram icon with blue tone

#### Files Created

- Shows total number of media files (images/videos) uploaded
- Direct link to Shopify Admin → Content → Files (filtered by instagram-post\_\*)
- Image icon with green tone

#### Metaobjects

- Shows total count of metaobjects created (posts + list)
- Direct link to Shopify Admin → Content → Metaobjects
- File icon with warning tone

### 3. Sync Controls

- **Primary Action Button**: "Sync Now" with refresh icon
  - Located in page header for easy access
  - Shows loading state during sync
  - Triggers manual Instagram data fetch
- **Last Sync Time**: Displays relative time of last synchronization
  - "Just now", "X minutes ago", "X hours ago", "X days ago"
  - Located in sync status card with calendar icon

### 4. Information Banner

- Explains automatic sync behavior
- Provides guidance on manual sync usage
- Notes about sync duration expectations

## Technical Implementation

### Loader Function

- Fetches Instagram account from Prisma database
- Queries Instagram Graph API for profile info
- Counts metaobjects and files using Shopify GraphQL API
- Returns comprehensive sync statistics

### Action Function

- Handles POST requests for manual sync
- Calls the Instagram sync endpoint internally
- Returns success/error feedback

### UI Components (Polaris)

- `Page`: Main container with title and primary action
- `Layout`: Responsive grid layout
- `Card`: Information containers
- `Badge`: Status indicators
- `Icon`: Visual identifiers
- `Link`: External navigation to Shopify Admin
- `Banner`: Informational messages
- `Button`: Action triggers

## Data Flow

```
User Action (Sync)
    ↓
Action Handler (POST)
    ↓
/api/instagram/staged-upload endpoint
    ↓
Instagram Graph API
    ↓
Shopify GraphQL (Create Files & Metaobjects)
    ↓
Prisma Database (Update sync info)
    ↓
Loader Refetch
    ↓
UI Update with new stats
```

## Shop Admin Links

### Metaobjects

```
https://admin.shopify.com/store/{shop}/content/metaobjects/instagram-post
https://admin.shopify.com/store/{shop}/content/metaobjects
```

### Files

```
https://admin.shopify.com/store/{shop}/content/files?selectedView=all&media_type=IMAGE,VIDEO&query=alt:instagram-post_*
```

## Future Enhancements

- Profile picture display from Instagram API
- Sync history/logs viewer
- Error state handling and display
- Individual post preview
- Sync scheduling configuration
- Webhook status monitoring
