import { LoaderFunctionArgs, redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  if (!shop) {
    return new Response("Missing shop parameter", { status: 400 });
  }

  const appId = process.env.INSTAGRAM_APP_ID!;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;
  const scope = process.env.INSTA_SCOPES!;
  
  // Store the shop in the state parameter
  const state = btoa(JSON.stringify({ shop }));
  
  const authUrl = `https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;

  // Temporary debug mode: if the caller includes ?debug=1 we return the authUrl as plain text
  // so you can copy the exact redirect_uri parameter (including encoding) without performing
  // the redirect. This file change is local and will be reverted after debugging.
  const debug = url.searchParams.get("debug") === "1";
  if (debug) {
    console.log("[debug] INSTAGRAM authUrl:", authUrl);
    return new Response(authUrl, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return redirect(authUrl);
};