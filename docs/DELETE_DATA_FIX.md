# Delete Data Fix - December 12, 2025

## Problem

1. Delete Data and Disconnect buttons were deleting ALL files in Shopify, not just the ones created by the Instagram app
2. No visual feedback was shown to users about what was deleted

## Root Cause

The GraphQL query `query: "alt:instagram-post_"` was matching ALL files that contained "instagram-post\_" anywhere in the alt text, but wasn't filtering the results properly on the client side.

## Solution

### 1. Added Client-Side Filtering

After querying files, we now explicitly filter to ONLY include files where the alt text **starts with** `instagram-post_`:

```typescript
// Filter to ONLY files with alt text starting with "instagram-post_"
const instagramFiles =
  filesJson.data?.files?.edges?.filter((edge: any) =>
    edge.node.alt?.startsWith("instagram-post_"),
  ) || [];

const fileIds = instagramFiles.map((edge: any) => edge.node.id);
```

This ensures we only delete:

- `instagram-post_18329761975242473` ✅
- `instagram-post_18376316866157091_child123` ✅

And NOT:

- `my-instagram-post_custom` ❌
- `product-image` ❌

### 2. Added Visual Feedback

- Action now returns deletion counts in the response:

  ```typescript
  return json({
    success: true,
    deletedMetaobjects: totalMetaobjects,
    deletedFiles: fileIds.length,
    message: `Deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
  });
  ```

- UI displays a success banner with details:

  ```
  ✓ Successfully deleted 7 metaobjects and 14 files
  ```

- Banner shows for 2 seconds before page reloads

### 3. Improved Console Logging

Both delete actions now log clear messages:

```
✓ Deleted 7 metaobjects and 14 files
✓ Disconnected account and deleted 7 metaobjects and 14 files
```

## File Naming Convention

All files created by this app follow the pattern:

- Single images: `instagram-post_{postId}`
- Carousel children: `instagram-post_{postId}_{childId}`

This prefix ensures safe deletion without affecting other Shopify files.

## Testing

1. Click "Delete Data" button
2. Confirm the dialog
3. See green success banner: "✓ Successfully deleted X metaobjects and Y files"
4. Page reloads after 2 seconds
5. Statistics show 0 counts
6. Verify in Shopify admin that ONLY instagram files were deleted

## Files Modified

- `app/routes/app._index.tsx`: Added filtering logic, visual feedback, and deletion counts
