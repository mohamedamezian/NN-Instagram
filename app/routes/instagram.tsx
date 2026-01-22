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
  
  // Use the correct Instagram Basic Display API OAuth endpoint
  const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${state}`;

  console.log('Instagram OAuth URL:', authUrl);
  console.log('Redirect URI:', redirectUri);
  console.log('App ID:', appId);

  return redirect(authUrl);
};

