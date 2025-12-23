import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useLoaderData,
  useSubmit,
  useNavigation,
  useFetcher,
} from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

interface SyncStats {
  lastSyncTime: string | null;
  postsCount: number;
  filesCount: number;
  metaobjectsCount: number;
}

interface InstagramAccount {
  username: string;
  userId: string;
  profilePicture?: string;
  connectedAt: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Get Instagram account info
  const socialAccount = await prisma.socialAccount.findUnique({
    where: {
      shop_provider: {
        shop: session.shop,
        provider: "instagram",
      },
    },
  });

  let instagramAccount: InstagramAccount | null = null;
  let syncStats: SyncStats = {
    lastSyncTime: null,
    postsCount: 0,
    filesCount: 0,
    metaobjectsCount: 0,
  };

  if (socialAccount) {
    // Fetch Instagram profile info
    try {
      const profileResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username,profile_picture_url,media_count&access_token=${socialAccount.accessToken}`,
      );
      const profileData = await profileResponse.json();

      instagramAccount = {
        username: profileData.username || "Unknown",
        userId: profileData.id,
        profilePicture: profileData.profile_picture_url,
        connectedAt: socialAccount.createdAt.toISOString(),
      };
    } catch (error) {
      console.error("Error fetching Instagram profile:", error);
    }

    // Get sync statistics from Shopify
    try {
      // Count instagram-post metaobjects (type filter ensures only instagram-post type)
      const postsCountQuery = await admin.graphql(`#graphql
        query {
          metaobjects(type: "instagram-post", first: 250) {
            nodes {
              id
            }
          }
        }
      `);
      const postsCountData = await postsCountQuery.json();

      // Get instagram-list metaobject and last sync time
      const listQuery = await admin.graphql(`#graphql
        query {
          metaobjects(type: "instagram-list", first: 1) {
            nodes {
              id
              fields {
                key
                value
              }
              updatedAt
            }
          }
        }
      `);
      const listData = await listQuery.json();

      // Count files with instagram-post prefix in alt text
      // Using "instagram-post_" prefix to match our file naming convention
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
      const filesCountData = await filesCountQuery.json();

      // Filter files to only those starting with "instagram"
      const instagramFiles =
        filesCountData.data?.files?.edges?.filter((edge: any) =>
          edge.node.alt?.startsWith("instagram"),
        ) || [];

      // Calculate metaobjects count: posts + list (if exists)
      const postsCount = postsCountData.data?.metaobjects?.nodes?.length || 0;
      const hasListMetaobject =
        (listData.data?.metaobjects?.nodes?.length || 0) > 0;

      syncStats = {
        lastSyncTime: listData.data?.metaobjects?.nodes?.[0]?.updatedAt || null,
        postsCount: postsCount,
        filesCount: instagramFiles.length,
        metaobjectsCount: postsCount + (hasListMetaobject ? 1 : 0),
      };
    } catch (error) {
      console.error("Error fetching sync stats:", error);
    }
  }

  return {
    shop: session.shop,
    instagramAccount,
    syncStats,
    isConnected: !!socialAccount,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "sync") {
    try {
      // Trigger the sync by calling the instagram sync endpoint
      const syncUrl = new URL(request.url);
      syncUrl.pathname = "/api/instagram/staged-upload";

      const response = await fetch(syncUrl.toString(), {
        headers: {
          Cookie: request.headers.get("Cookie") || "",
        },
      });

      if (!response.ok) {
        throw new Error("Sync failed");
      }

      return { success: true, message: "Sync completed successfully!" };
    } catch (error) {
      return {
        success: false,
        message: "Sync failed. Please try again.",
      };
    }
  }

  if (actionType === "delete-data") {
    try {
      // Delete all Instagram data directly
      // Query instagram_post metaobjects
      const postMetaobjectsQuery = await admin.graphql(`
        #graphql
        query {
          metaobjects(type: "instagram-post", first: 250) {
            edges { node { id } }
          }
        }
      `);
      const postMetaobjectsJson = await postMetaobjectsQuery.json();
      const postMetaobjectIds =
        postMetaobjectsJson.data?.metaobjects?.edges?.map(
          (e: any) => e.node.id,
        ) || [];

      // Query instagram_list metaobjects
      const listMetaobjectsQuery = await admin.graphql(`
        #graphql
        query {
          metaobjects(type: "instagram-list", first: 10) {
            edges { node { id } }
          }
        }
      `);
      const listMetaobjectsJson = await listMetaobjectsQuery.json();
      const listMetaobjectIds =
        listMetaobjectsJson.data?.metaobjects?.edges?.map(
          (e: any) => e.node.id,
        ) || [];

      // Delete all metaobjects
      for (const id of [...postMetaobjectIds, ...listMetaobjectIds]) {
        await admin.graphql(
          `
          #graphql
          mutation metaobjectDelete($id: ID!) {
            metaobjectDelete(id: $id) {
              deletedId
              userErrors { field message }
            }
          }
        `,
          { variables: { id } },
        );
      }

      // Delete ONLY files created by this app (with instagram-post_ prefix in alt text)
      const filesQuery = await admin.graphql(`
        #graphql
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
      const filesJson = await filesQuery.json();

      // Filter to ONLY files with alt text starting with "instagram-post_"
      const instagramFiles =
        filesJson.data?.files?.edges?.filter((edge: any) =>
          edge.node.alt?.startsWith("instagram-post_"),
        ) || [];

      const fileIds = instagramFiles.map((edge: any) => edge.node.id);

      if (fileIds.length > 0) {
        await admin.graphql(
          `
          #graphql
          mutation fileDelete($fileIds: [ID!]!) {
            fileDelete(fileIds: $fileIds) {
              deletedFileIds
              userErrors { field message }
            }
          }
        `,
          { variables: { fileIds } },
        );
      }

      const totalMetaobjects =
        postMetaobjectIds.length + listMetaobjectIds.length;
      console.log(
        `✓ Deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
      );

      return {
        success: true,
        deletedMetaobjects: totalMetaobjects,
        deletedFiles: fileIds.length,
        message: `Deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
      };
    } catch (error) {
      console.error("Delete error:", error);
      return {
        success: false,
        message: "Delete failed. Please try again.",
        status: 500,
      };
    }
  }

  if (actionType === "disconnect") {
    try {
      // First delete all Instagram data
      // Query instagram_post metaobjects
      const postMetaobjectsQuery = await admin.graphql(`
        #graphql
        query {
          metaobjects(type: "instagram-post", first: 250) {
            edges { node { id } }
          }
        }
      `);
      const postMetaobjectsJson = await postMetaobjectsQuery.json();
      const postMetaobjectIds =
        postMetaobjectsJson.data?.metaobjects?.edges?.map(
          (e: any) => e.node.id,
        ) || [];

      // Query instagram_list metaobjects
      const listMetaobjectsQuery = await admin.graphql(`
        #graphql
        query {
          metaobjects(type: "instagram-list", first: 10) {
            edges { node { id } }
          }
        }
      `);
      const listMetaobjectsJson = await listMetaobjectsQuery.json();
      const listMetaobjectIds =
        listMetaobjectsJson.data?.metaobjects?.edges?.map(
          (e: any) => e.node.id,
        ) || [];

      // Delete all metaobjects
      for (const id of [...postMetaobjectIds, ...listMetaobjectIds]) {
        await admin.graphql(
          `
          #graphql
          mutation metaobjectDelete($id: ID!) {
            metaobjectDelete(id: $id) {
              deletedId
              userErrors { field message }
            }
          }
        `,
          { variables: { id } },
        );
      }

      // Delete ONLY files created by this app (with instagram-post_ prefix in alt text)
      const filesQuery = await admin.graphql(`
        #graphql
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
      const filesJson = await filesQuery.json();

      // Filter to ONLY files with alt text starting with "instagram-post_"
      const instagramFiles =
        filesJson.data?.files?.edges?.filter((edge: any) =>
          edge.node.alt?.startsWith("instagram-post_"),
        ) || [];

      const fileIds = instagramFiles.map((edge: any) => edge.node.id);

      if (fileIds.length > 0) {
        await admin.graphql(
          `
          #graphql
          mutation fileDelete($fileIds: [ID!]!) {
            fileDelete(fileIds: $fileIds) {
              deletedFileIds
              userErrors { field message }
            }
          }
        `,
          { variables: { fileIds } },
        );
      }

      // Then remove the social account connection
      await prisma.socialAccount.delete({
        where: {
          shop_provider: {
            shop: session.shop,
            provider: "instagram",
          },
        },
      });

      const totalMetaobjects =
        postMetaobjectIds.length + listMetaobjectIds.length;
      console.log(
        `✓ Disconnected account and deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
      );

      return {
        success: true,
        deletedMetaobjects: totalMetaobjects,
        deletedFiles: fileIds.length,
        message: `Disconnected and deleted ${totalMetaobjects} metaobjects and ${fileIds.length} files`,
      };
    } catch (error) {
      console.error("Disconnect error:", error);
      return {
        success: false,
        message: "Disconnect failed. Please try again.",
        status: 500,
      };
    }
  }

  return { success: false, message: "Invalid action", status: 400 };
};

export default function Index() {
  const { shop, instagramAccount, syncStats, isConnected } =
    useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const syncFetcher = useFetcher();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [syncProgress, setSyncProgress] = useState(0);
  const [deleteMessage, setDeleteMessage] = useState<string>("");

  const isActionRunning =
    navigation.state === "submitting" || fetcher.state === "submitting";

  // Handle fetcher response (for delete/disconnect actions)
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      const data = fetcher.data as {
        success?: boolean;
        deletedMetaobjects?: number;
        deletedFiles?: number;
        message?: string;
      };
      if (data.success) {
        // Show success message with details
        if (
          data.deletedMetaobjects !== undefined &&
          data.deletedFiles !== undefined
        ) {
          setDeleteMessage(
            `✓ Successfully deleted ${data.deletedMetaobjects} metaobjects and ${data.deletedFiles} files`,
          );

          // Auto-dismiss message after 5 seconds
          setTimeout(() => {
            setDeleteMessage("");
          }, 5000);
        }
        // Don't reload - the fetcher automatically revalidates the loader
        // This keeps the Shopify session intact
      }
    }
  }, [fetcher.data, fetcher.state]);

  const handleSync = () => {
    setIsSyncing(true);
    setSyncStatus("Connecting to Instagram...");
    setSyncProgress(10);

    // Use fetcher to call the sync endpoint
    syncFetcher.load("/api/instagram/staged-upload");
  };

  // Handle sync fetcher response
  useEffect(() => {
    if (syncFetcher.state === "loading" && isSyncing) {
      setSyncStatus("Fetching Instagram posts...");
      setSyncProgress(30);
    }

    if (syncFetcher.state === "idle" && syncFetcher.data && isSyncing) {
      const result = syncFetcher.data as any;

      // Check if there was an error in the response
      if (result.error) {
        setSyncStatus(`❌ ${result.error}`);
        setSyncProgress(0);
        setTimeout(() => setIsSyncing(false), 5000);
        return;
      }

      // Success!
      setSyncStatus("Uploading media files to Shopify...");
      setSyncProgress(60);

      setTimeout(() => {
        setSyncStatus("Creating metaobjects...");
        setSyncProgress(80);

        setTimeout(() => {
          setSyncProgress(100);
          setSyncStatus("✓ Sync completed successfully!");

          // Reset and let the fetcher auto-revalidate the loader
          setTimeout(() => {
            setIsSyncing(false);
            setSyncStatus("");
            setSyncProgress(0);
          }, 2000);
        }, 1500);
      }, 2000);
    }
  }, [syncFetcher.state, syncFetcher.data, isSyncing]);

  const handleConnect = () => {
    window.open(
      `/instagram?shop=${encodeURIComponent(shop)}`,
      "_parent",
      "width=600,height=700",
    );
  };

  const handleSwitchAccount = () => {
    window.open(
      `/instagram?shop=${encodeURIComponent(shop)}`,
      "_parent",
      "width=600,height=700",
    );
  };

  const handleDeleteData = () => {
    if (
      confirm(
        "Are you sure you want to delete all Instagram posts, files, and metaobjects? This cannot be undone.",
      )
    ) {
      const formData = new FormData();
      formData.append("action", "delete-data");
      fetcher.submit(formData, { method: "post" });
    }
  };

  const handleDisconnect = () => {
    if (
      confirm(
        "Are you sure you want to disconnect your Instagram account? This will delete all synced data and cannot be undone.",
      )
    ) {
      const formData = new FormData();
      formData.append("action", "disconnect");
      fetcher.submit(formData, { method: "post" });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  return (
    <s-page>
      {/* Delete Success Banner */}
      {deleteMessage && (
        <s-section>
          <s-banner tone="success" onDismiss={() => setDeleteMessage("")}>
            {deleteMessage}
          </s-banner>
        </s-section>
      )}

      {/* Manual Sync Card */}
      {isConnected && (
        <s-section>
          <s-banner tone="info">
            Your Instagram posts sync automatically every 24 hours. Use the
            "Sync Now" button above to manually fetch the latest posts.
          </s-banner>
          <s-card>
            <s-stack gap="base">
              <s-stack gap="small-500">
                <s-heading>Instagram Sync</s-heading>

                <s-text color="subdued">
                  Fetch and sync your latest Instagram posts to Shopify
                </s-text>
              </s-stack>

              {isSyncing && (
                <s-stack gap="base">
                  <s-stack gap="small-200" direction="inline">
                    <s-spinner />
                    <s-text>{syncStatus}</s-text>
                  </s-stack>
                  {syncProgress > 0 && (
                    <div
                      style={{
                        width: "100%",
                        height: "4px",
                        background: "#e1e1e1",
                        borderRadius: "2px",
                      }}
                    >
                      <div
                        style={{
                          width: `${syncProgress}%`,
                          height: "100%",
                          background: "#008060",
                          borderRadius: "2px",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  )}
                </s-stack>
              )}

              {!isSyncing && (
                <s-stack gap="small-100">
                  <s-box>
                    <s-button
                      onClick={handleSync}
                      loading={isSyncing}
                      disabled={isActionRunning}
                    >
                      Sync Now
                    </s-button>
                  </s-box>
                  {syncStats.lastSyncTime && (
                    <s-text color="subdued">
                      Last synced {formatDate(syncStats.lastSyncTime)}
                    </s-text>
                  )}
                </s-stack>
              )}
            </s-stack>
          </s-card>
        </s-section>
      )}

      {/* Connection Status */}
      <s-section>
        <s-card>
          <s-stack gap="base">
            <s-stack direction="inline" gap="small-200">
              <s-heading>Instagram Account</s-heading>
              {isConnected ? (
                <s-badge tone="success">Connected</s-badge>
              ) : (
                <s-badge tone="critical">Not Connected</s-badge>
              )}
            </s-stack>

            {isConnected && instagramAccount ? (
              <s-stack gap="base">
                <s-stack gap="base" direction="inline">
                  {instagramAccount.profilePicture && (
                    <s-thumbnail
                      src={instagramAccount.profilePicture}
                      alt={instagramAccount.username}
                      size="large"
                    />
                  )}
                  <s-stack gap="small-100">
                    <s-text type="strong">@{instagramAccount.username}</s-text>
                    <s-text color="subdued">
                      User ID: {instagramAccount.userId}
                    </s-text>
                    <s-text color="subdued">
                      Connected {formatDate(instagramAccount.connectedAt)}
                    </s-text>
                  </s-stack>
                </s-stack>

                <s-divider />

                <s-stack gap="small-200" direction="inline">
                  <s-button
                    onClick={handleSwitchAccount}
                    disabled={isSyncing || isActionRunning}
                  >
                    Switch Account
                  </s-button>
                  <s-button
                    onClick={handleDeleteData}
                    tone="critical"
                    loading={
                      fetcher.state === "submitting" &&
                      fetcher.formData?.get("action") === "delete-data"
                    }
                    disabled={isSyncing || isActionRunning}
                  >
                    Delete Data
                  </s-button>
                  <s-button
                    onClick={handleDisconnect}
                    tone="critical"
                    loading={
                      fetcher.state === "submitting" &&
                      fetcher.formData?.get("action") === "disconnect"
                    }
                    disabled={isSyncing || isActionRunning}
                  >
                    Disconnect
                  </s-button>
                </s-stack>
              </s-stack>
            ) : (
              <s-stack gap="base">
                <s-text>
                  Connect your Instagram Business account to sync posts to
                  Shopify metaobjects and files.
                </s-text>
                <s-box>
                  <s-button variant="primary" onClick={handleConnect}>
                    Connect Instagram Account
                  </s-button>
                </s-box>
              </s-stack>
            )}
          </s-stack>
        </s-card>
      </s-section>

      {/* Sync Statistics */}
      {isConnected && (
        <>
          <s-section>
            <s-card>
              <s-stack gap="base">
                <s-heading>Sync Statistics</s-heading>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px",
                  }}
                >
                  {/* Posts Card */}
                  <s-clickable
                    href={`https://admin.shopify.com/store/${shop.replace(
                      ".myshopify.com",
                      "",
                    )}/content/metaobjects/entries/instagram-post`}
                    target="_blank"
                    border="base"
                    borderRadius="base"
                    padding="base"
                  >
                    <s-stack gap="small-200">
                      <s-icon type="social-post" tone="info" />
                      <div style={{ fontSize: "28px", fontWeight: "600" }}>
                        {syncStats.postsCount}
                      </div>
                      <s-text color="subdued">Posts Synced</s-text>
                    </s-stack>
                  </s-clickable>

                  {/* Files Card */}
                  <s-clickable
                    href={`https://admin.shopify.com/store/${shop.replace(
                      ".myshopify.com",
                      "",
                    )}/content/files?selectedView=all&media_type=IMAGE%2CVIDEO&query=instagram`}
                    target="_blank"
                    border="base"
                    borderRadius="base"
                    padding="base"
                  >
                    <s-stack gap="small-200">
                      <s-icon type="image" tone="success" />
                      <div style={{ fontSize: "28px", fontWeight: "600" }}>
                        {syncStats.filesCount}
                      </div>
                      <s-text color="subdued">Files Created</s-text>
                    </s-stack>
                  </s-clickable>

                  {/* Metaobjects Card */}
                  <s-clickable
                    href={`https://admin.shopify.com/store/${shop.replace(
                      ".myshopify.com",
                      "",
                    )}/content/metaobjects`}
                    target="_blank"
                    border="base"
                    borderRadius="base"
                    padding="base"
                  >
                    <s-stack gap="small-200">
                      <s-icon type="file" tone="warning" />
                      <div style={{ fontSize: "28px", fontWeight: "600" }}>
                        {syncStats.metaobjectsCount}
                      </div>
                      <s-text color="subdued">Metaobjects</s-text>
                    </s-stack>
                  </s-clickable>
                </div>
              </s-stack>
            </s-card>
          </s-section>

          {/* Theme Snippets Download Section */}
          <s-section>
            <s-card>
              <s-stack gap="base">
                <s-stack gap="small-200">
                  <s-heading>Theme Integration</s-heading>
                  <s-text color="subdued">
                    Download ready-to-use Liquid snippets for your Shopify theme
                  </s-text>
                </s-stack>

                <s-banner tone="info">
                  Coming soon: Download pre-built theme snippets to quickly add
                  Instagram feeds to your store
                </s-banner>
              </s-stack>
            </s-card>
          </s-section>

          {/* Developer Guide */}
          <s-section>
            <s-card>
              <s-stack gap="base">
                <s-heading>Developer Guide</s-heading>

                <s-text color="subdued">
                  Access the synced Instagram posts in your theme with this
                  simple Liquid code.
                </s-text>

                <s-divider />

                <s-stack gap="small-200">
                  <s-text type="strong">Accessing the Data</s-text>
                  <s-box
                    padding="base"
                    background="subdued"
                    borderRadius="base"
                  >
                    <pre
                      style={{
                        fontSize: "12px",
                        lineHeight: "1.5",
                        overflow: "auto",
                        margin: 0,
                        fontFamily: "monospace",
                      }}
                    >
                      {`{% assign instagram = metaobjects['instagram-list']['instagram-feed-list'] %}

{% for post in instagram.posts.value %}
  {{ post.caption.value }}
  {{ post.likes.value }}
  {{ post.comments.value }}
  
  {% for media in post.images.value %}
    {{ media | image_url: width: 800 }}
  {% endfor %}
{% endfor %}`}
                    </pre>
                  </s-box>
                </s-stack>

                <s-divider />

                <s-stack gap="small-200">
                  <s-text type="strong">Available Fields</s-text>
                  <s-text color="subdued">
                    Each post includes: caption, likes, comments, images, and
                    permalink
                  </s-text>
                </s-stack>

                <s-banner tone="info">
                  <s-text>
                    Click the statistics cards above to view your metaobjects in
                    Shopify admin and explore all fields.
                  </s-text>
                </s-banner>
              </s-stack>
            </s-card>
          </s-section>
        </>
      )}
    </s-page>
  );
}
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
