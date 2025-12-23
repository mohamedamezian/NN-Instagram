# Dashboard Filtering Fix

## Problem

The dashboard was showing all metaobjects and files in the Shopify store, not just the ones created by the Instagram app.

## Solution

Updated the counting logic to ensure only Instagram-related resources are counted:

### 1. Metaobjects Filtering

✅ **Already Correct**: Using `type: "instagram-post"` in GraphQL query

- Only counts metaobjects with type `instagram-post`
- Shopify's type filter ensures no other metaobject types are included
- Separate query for `instagram-list` type

### 2. Files Filtering

✅ **Improved**: Added client-side filtering for files

- GraphQL query uses: `query: "alt:instagram-post_"`
- Additional filter: `edge.node.alt?.startsWith("instagram-post_")`
- Only counts files where alt text starts with `instagram-post_`

### File Naming Convention

All Instagram media files are created with the following alt text format:

- Single images/videos: `instagram-post_{postId}`
- Carousel items: `instagram-post_{postId}_{childId}`

### 3. Admin Links Updated

Updated the Files link to use cleaner query:

- Before: `query=alt:instagram-post_*` (with wildcard)
- After: `query=instagram-post_` (simpler search)

## Code Changes

### Loader Function - Statistics Query

```typescript
// Count only instagram-post type metaobjects
const postsCountQuery = await admin.graphql(`#graphql
  query {
    metaobjects(type: "instagram-post", first: 250) {
      nodes {
        id
      }
    }
  }
`);

// Count files with instagram-post_ prefix
const filesCountQuery = await admin.graphql(`#graphql
  query {
    files(first: 250, query: "alt:instagram-post_") {
      edges {
        node {
          id
          alt
        }
      }
    }
  }
`);

// Additional client-side filtering
const instagramFiles =
  filesCountData.data?.files?.edges?.filter((edge: any) =>
    edge.node.alt?.startsWith("instagram-post_"),
  ) || [];
```

### Accurate Counts

```typescript
syncStats = {
  lastSyncTime: listData.data?.metaobjects?.nodes?.[0]?.updatedAt || null,
  postsCount: postsCount,
  filesCount: instagramFiles.length, // Only instagram files
  metaobjectsCount: postsCount + (hasListMetaobject ? 1 : 0),
};
```

## Result

✅ Dashboard now shows accurate counts:

- **Posts Synced**: Only `instagram-post` metaobjects
- **Files Created**: Only files with `instagram-post_` prefix
- **Metaobjects**: Sum of instagram posts + instagram list
- **Admin Links**: Properly filtered to show only Instagram resources

## Testing

You can verify the counts by:

1. Checking the metaobjects page (should only show instagram-post type)
2. Checking the files page (should only show files with instagram-post\_ prefix)
3. Comparing dashboard counts with actual Shopify admin counts
