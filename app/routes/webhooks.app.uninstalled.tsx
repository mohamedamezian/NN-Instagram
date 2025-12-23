import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Clean up social media data for compliance
  try {
    await db.socialAccount.deleteMany({ where: { shop } });
    console.log(`Cleaned up social accounts for shop: ${shop}`);
  } catch (error) {
    console.error(`Failed to clean up social accounts for ${shop}:`, error);
  }

  return new Response();
};
