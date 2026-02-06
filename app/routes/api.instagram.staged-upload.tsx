import type { HeadersFunction, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { InstagramPost } from "app/types/instagram.types";
import {
  uploadMediaFile,
  upsertPostMetaobject,
  upsertListMetaobject,
  getExistingPost,
  deleteOldAccountData,
} from "../utils/instagram-sync.server";
import {
  getInstagramAccountWithToken,
  updateAccountUsername,
} from "../utils/account.server";

/**
 * API endpoint to sync Instagram posts to Shopify
 *
 * This endpoint:
 * 1. Fetches Instagram posts from the Graph API
 * 2. Uploads media files to Shopify
 * 3. Creates/updates metaobjects for each post
 * 4. Creates a list metaobject containing all posts
 *
 * @returns Success status with username and display name, or error message
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Authenticate the request and get session + admin API client
  const { session, admin } = await authenticate.admin(request);

  // Get Instagram account from database with decrypted token
  const account = await getInstagramAccountWithToken(session.shop);

  if (!account) {
    return { error: "No Instagram account connected" };
  }

  // Check if Instagram token has expired
  if (account.expiresAt && new Date(account.expiresAt) < new Date()) {
    return {
      error:
        "Instagram token has expired. Please reconnect your Instagram account.",
      expired: true,
    };
  }

  // Fetch Instagram media posts from the Graph API
  // Includes post details, media URLs, engagement metrics, and carousel children
  const igResponse = await fetch(
    `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,view_count,like_count,comments_count,permalink,caption,timestamp,children{media_url,media_type,thumbnail_url}&access_token=${account.accessToken}`,
  );
  const igData = await igResponse.json();

  // Handle Instagram API errors (e.g., invalid token, rate limits)
  if (igData.error) {
    console.error("Instagram API error:", igData.error);
    return {
      error: `Instagram API error: ${igData.error.message || "Invalid or expired token"}. Please reconnect your Instagram account.`,
      igError: igData.error,
    };
  }

  // Fetch Instagram user profile information
  const igUserResponse = await fetch(
    `https://graph.instagram.com/me/?fields=followers_count,name,username&access_token=${account.accessToken}`,
  );
  const userData = await igUserResponse.json();

  if (userData.error) {
    return {
      error: `Instagram API error: ${userData.error.message || "Invalid or expired token"}. Please reconnect your Instagram account.`,
      igError: userData.error,
    };
  }

  const posts = igData.data as InstagramPost[];
  const currentUsername = userData.username;
  const displayName = userData.name;

  // Early return if no posts to sync
  if (!posts || posts.length === 0) {
    return {
      success: true,
      message: "No Instagram posts found to sync",
      postsCount: 0,
    };
  }

  // Handle Instagram account switch
  // If the username has changed, delete old data associated with the previous account
  if (account.username && account.username !== currentUsername) {
    await deleteOldAccountData(admin, account.username);
  }

  // Update stored username if it's new or has changed
  if (!account.username || account.username !== currentUsername) {
    await updateAccountUsername(account.id, currentUsername);
  }

  // Array to store metaobject IDs for the final list
  const postObjectIds: string[] = [];

  // Process each Instagram post
  for (const post of posts) {
    let fileIds: string[] = [];

    // Check if this post already exists in Shopify
    const existingPost = await getExistingPost(admin, post.id, currentUsername);

    if (existingPost) {
      // Post exists - reuse existing file IDs and update metaobject with new data
      fileIds = existingPost.fileIds;

      const metaobjectResult = await upsertPostMetaobject(
        admin,
        post,
        fileIds,
        currentUsername,
      );

      // Log any errors from updating the metaobject
      if (
        metaobjectResult.data?.metaobjectUpsert?.userErrors &&
        metaobjectResult.data.metaobjectUpsert.userErrors.length > 0
      ) {
        console.error(
          `Error updating post ${post.id}:`,
          metaobjectResult.data.metaobjectUpsert.userErrors,
        );
      } else {
        const metaobjectId =
          metaobjectResult.data?.metaobjectUpsert?.metaobject?.id;
        if (metaobjectId) {
          postObjectIds.push(metaobjectId);
        }
      }
    } else {
      // New post - upload media files to Shopify first

      if (post.media_type === "CAROUSEL_ALBUM" && post.children?.data) {
        // Handle carousel posts by uploading each child media item
        for (let i = 0; i < post.children.data.length; i++) {
          const child = post.children.data[i];
          // Use alt text format: username-post_postId_childId for tracking
          const childAlt = `${currentUsername}-post_${post.id}_${child.id}`;

          const result = await uploadMediaFile(
            admin,
            child.media_url,
            child.media_type,
            childAlt,
          );

          const childFileIds = (result.data?.fileCreate?.files || []).map(
            (f) => f.id,
          );
          fileIds.push(...childFileIds);
        }
      } else {
        // Handle single image/video posts
        // Use alt text format: username-post_postId for tracking
        const alt = `${currentUsername}-post_${post.id}`;

        const result = await uploadMediaFile(
          admin,
          post.media_url,
          post.media_type,
          alt,
        );

        const singleFileIds = (result.data?.fileCreate?.files || []).map(
          (f) => f.id,
        );
        fileIds.push(...singleFileIds);
      }

      // Create metaobject for the post with the uploaded file IDs
      if (fileIds.length > 0) {
        const metaobjectResult = await upsertPostMetaobject(
          admin,
          post,
          fileIds,
          currentUsername,
        );

        // Log any errors from creating the metaobject
        if (
          metaobjectResult.data?.metaobjectUpsert?.userErrors &&
          metaobjectResult.data.metaobjectUpsert.userErrors.length > 0
        ) {
          console.error(
            `Error creating post ${post.id}:`,
            metaobjectResult.data.metaobjectUpsert.userErrors,
          );
        } else {
          const metaobjectId =
            metaobjectResult.data?.metaobjectUpsert?.metaobject?.id;
          if (metaobjectId) {
            postObjectIds.push(metaobjectId);
          }
        }
      }
    }
  }

  // Create or update the list metaobject that references all posts
  // This serves as the main entry point for displaying the Instagram feed
  if (postObjectIds.length > 0) {
    const listResult = await upsertListMetaobject(
      admin,
      igData,
      postObjectIds,
      currentUsername,
      displayName,
    );

    if (
      listResult.data?.metaobjectUpsert?.userErrors &&
      listResult.data.metaobjectUpsert.userErrors.length > 0
    ) {
      console.error(
        `Error creating list:`,
        listResult.data.metaobjectUpsert.userErrors,
      );
    }
  }

  return {
    success: true,
    username: currentUsername,
    displayName,
  };
};

/**
 * Set appropriate headers for the response
 * Uses boundary headers for proper Shopify app integration
 */
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
