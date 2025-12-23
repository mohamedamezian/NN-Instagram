import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
      return new Response("Missing code from Instagram", { status: 400 });
    }

    // Extract shop from state parameter
    let shop = "unknown-shop";
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        shop = stateData.shop || "unknown-shop";
      } catch (error) {
        console.error("Failed to parse state parameter:", error);
      }
    }

    const tokenUrl = `https://api.instagram.com/oauth/access_token`;

    // Exchange code for access token
    const res = await fetch(tokenUrl, {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID!,
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
        code,
      }),
    });

    const data = await res.json();

    // Check if we got a short-lived token successfully
    if (!data.access_token) {
      return new Response(
        `Failed to get Instagram token: ${JSON.stringify(data, null, 2)}`,
        { status: 400, headers: { "Content-Type": "text/plain" } },
      );
    }

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${data.access_token}`;

    const longLivedRes = await fetch(longLivedTokenUrl, { method: "GET" });
    const longLivedData = await longLivedRes.json();

    // Use the long-lived token if successful, otherwise fall back to short-lived
    const finalToken = longLivedData.access_token || data.access_token;
    const tokenType = longLivedData.access_token ? "long-lived" : "short-lived";
    const expiresAt = longLivedData.expires_in
      ? new Date(Date.now() + longLivedData.expires_in * 1000)
      : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days default

    // Update existing or create new Instagram token
    try {
      await prisma.socialAccount.upsert({
        where: {
          shop_provider: {
            shop: shop,
            provider: "instagram",
          },
        },
        update: {
          accessToken: finalToken,
          userId: data.user_id?.toString(),
          expiresAt: expiresAt,
        },
        create: {
          shop: shop,
          provider: "instagram",
          accessToken: finalToken,
          userId: data.user_id?.toString(),
          expiresAt: expiresAt,
        },
      });

      // Create HTML success page that redirects back to Shopify
      const shopSlug = shop.replace(".myshopify.com", "");
      const appSlug = process.env.SHOPIFY_APP_SLUG || "ig-devtools";
      // Debug: log which slug we're using for redirect
      console.log(
        `[instagram.callback] shopSlug=${shopSlug} appSlug=${appSlug}`,
      );
      const successHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Instagram Connected</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            
            .container {
              background: white;
              border-radius: 20px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              padding: 48px;
              max-width: 480px;
              width: 100%;
              text-align: center;
              animation: slideUp 0.5s ease-out;
            }
            
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            .icon-container {
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              animation: scaleIn 0.5s ease-out 0.2s both;
            }
            
            @keyframes scaleIn {
              from {
                transform: scale(0);
              }
              to {
                transform: scale(1);
              }
            }
            
            .checkmark {
              width: 40px;
              height: 40px;
              border: 4px solid white;
              border-radius: 50%;
              position: relative;
            }
            
            .checkmark::after {
              content: '';
              position: absolute;
              width: 12px;
              height: 20px;
              border: solid white;
              border-width: 0 4px 4px 0;
              transform: rotate(45deg);
              left: 10px;
              top: 4px;
            }
            
            h1 {
              font-size: 28px;
              font-weight: 700;
              color: #1a202c;
              margin-bottom: 12px;
            }
            
            .subtitle {
              font-size: 16px;
              color: #718096;
              margin-bottom: 32px;
            }
            
            .details {
              background: #f7fafc;
              border-radius: 12px;
              padding: 24px;
              margin-bottom: 24px;
              text-align: left;
            }
            
            .detail-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 0;
              border-bottom: 1px solid #e2e8f0;
            }
            
            .detail-row:last-child {
              border-bottom: none;
            }
            
            .detail-label {
              font-size: 14px;
              color: #718096;
              font-weight: 500;
            }
            
            .detail-value {
              font-size: 14px;
              color: #2d3748;
              font-weight: 600;
            }
            
            .badge {
              display: inline-block;
              padding: 4px 12px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .redirect-info {
              font-size: 14px;
              color: #718096;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            }
            
            .spinner {
              width: 16px;
              height: 16px;
              border: 2px solid #e2e8f0;
              border-top-color: #667eea;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }
            
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            
            @media (max-width: 480px) {
              .container {
                padding: 32px 24px;
              }
              
              h1 {
                font-size: 24px;
              }
              
              .icon-container {
                width: 64px;
                height: 64px;
              }
              
              .checkmark {
                width: 32px;
                height: 32px;
              }
              
              .checkmark::after {
                width: 10px;
                height: 16px;
                left: 8px;
                top: 3px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon-container">
              <div class="checkmark"></div>
            </div>
            
            <h1>Instagram Connected!</h1>
            <p class="subtitle">Your account has been successfully linked</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">Shop</span>
                <span class="detail-value">${shop.replace(".myshopify.com", "")}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Token Type</span>
                <span class="badge">${tokenType}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Valid Until</span>
                <span class="detail-value">${expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">User ID</span>
                <span class="detail-value">${data.user_id}</span>
              </div>
            </div>
            
            <div class="redirect-info">
              <div class="spinner"></div>
              <span>Redirecting to your app...</span>
            </div>
          </div>
          
          <script>
            setTimeout(() => {
              window.location.href = 'https://admin.shopify.com/store/${shopSlug}/apps/nn_instagram/app/';
            }, 3000);
          </script>
        </body>
        </html>
      `;

      return new Response(successHtml, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        `Database error: ${dbError instanceof Error ? dbError.message : "Unknown error"}\n\nInstagram data received: ${JSON.stringify(data, null, 2)}`,
        { status: 500, headers: { "Content-Type": "text/plain" } },
      );
    }
  } catch (error) {
    console.error("General error:", error);
    return new Response(
      `Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 },
    );
  }
};
