import prisma from "../db.server";
import { decryptToken } from "./encryption.server";

export async function getInstagramAccount(shop: string) {
  return await prisma.socialAccount.findUnique({
    where: {
      shop_provider: {
        shop,
        provider: "instagram",
      },
    },
  });
}

/**
 * Get Instagram account with decrypted access token
 * Use this when you need to make API calls to Instagram
 */
export async function getInstagramAccountWithToken(shop: string) {
  const account = await getInstagramAccount(shop);
  
  if (!account) {
    return null;
  }
  
  // Decrypt the access token
  const decryptedToken = decryptToken(account.accessToken);
  
  return {
    ...account,
    accessToken: decryptedToken,
  };
}

export async function updateAccountUsername(accountId: string, username: string) {
  return await prisma.socialAccount.update({
    where: { id: accountId },
    data: { username },
  });
}

export async function deleteInstagramAccount(shop: string) {
  return await prisma.socialAccount.delete({
    where: {
      shop_provider: {
        shop,
        provider: "instagram",
      },
    },
  });
}
