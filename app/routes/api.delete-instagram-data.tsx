import { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersFunction } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Query instagram_post metaobjects
  const postMetaobjectsQuery = await admin.graphql(`
    #graphql
    query {
      metaobjects(type: "instagram-post", first: 100) {
        edges { node { id } }
      }
    }
  `);
  const postMetaobjectsJson = await postMetaobjectsQuery.json();
  const postMetaobjectIds = postMetaobjectsJson.data.metaobjects.edges.map(
    (e: any) => e.node.id,
  );

  // Query instagram_list metaobjects
  const listMetaobjectsQuery = await admin.graphql(`
    #graphql
    query {
      metaobjects(type: "instagram-list", first: 100) {
        edges { node { id } }
      }
    }
  `);
  const listMetaobjectsJson = await listMetaobjectsQuery.json();
  const listMetaobjectIds = listMetaobjectsJson.data.metaobjects.edges.map(
    (e: any) => e.node.id,
  );

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

  // Delete files with alt text starting with instagram_post_
  const filesQuery = await admin.graphql(`
    #graphql
    query {
      files(first: 100, query: "alt:instagram-post_") {
        edges { node { id } }
      }
    }
  `);
  const filesJson = await filesQuery.json();
  const fileIds = filesJson.data.files.edges.map((e: any) => e.node.id);

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

  return {
    deletedMetaobjects: [...postMetaobjectIds, ...listMetaobjectIds],
    deletedFiles: fileIds,
  };
};
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
