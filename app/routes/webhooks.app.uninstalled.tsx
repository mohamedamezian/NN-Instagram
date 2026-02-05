import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // authenticate.webhook() automatically validates HMAC signature
    const { topic, payload } = await authenticate.webhook(request);

    console.log(`Received webhook: ${topic}`);

    // Extract shop from payload
    const webhookPayload = payload as {
      id?: number;
      shop_domain?: string;
    };

    const shop = webhookPayload.shop_domain;

    if (!shop) {
      console.error("No shop domain found in webhook payload");
      return new Response(null, { status: 200 });
    }

    console.log(`Processing app uninstall for shop: ${shop}`);

    // Clean up database records
    // Webhook requests can trigger multiple times and after an app has already been uninstalled.
    // If this webhook already ran, the session may have been deleted previously.
    try {
      const deletedSessions = await db.session.deleteMany({ where: { shop } });
      console.log(`Deleted ${deletedSessions.count} sessions for ${shop}`);
    } catch (error) {
      console.error(`Failed to delete sessions for ${shop}:`, error);
    }

    // Clean up social media data for compliance
    try {
      const deletedAccounts = await db.socialAccount.deleteMany({
        where: { shop },
      });
      console.log(
        `Deleted ${deletedAccounts.count} social accounts for ${shop}`,
      );
    } catch (error) {
      console.error(`Failed to clean up social accounts for ${shop}:`, error);
    }

    // Always return 200 OK to acknowledge webhook receipt
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);

    // If authenticate.webhook() throws, HMAC validation failed
    // Return 401 Unauthorized
    if (error instanceof Error && error.message.includes("HMAC")) {
      return new Response("Unauthorized", { status: 401 });
    }

    // For other errors, return 200 to prevent retries
    // Shopify will retry webhooks that don't return 200
    return new Response(null, { status: 200 });
  }
};
