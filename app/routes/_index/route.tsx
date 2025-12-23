import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useNavigate } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../../shopify.server";

import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersFunction } from "react-router";

const MetaobjectDefinition = `#graphql
        mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
          metaobjectDefinitionCreate(definition: $definition) {
            metaobjectDefinition {
              name
              type
              fieldDefinitions {
                name
                key
              }
            }
            userErrors {
              field
              message
              code
            }
          }
        }`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    // First check if the metaobject definition already exists
    const checkResponse = await admin.graphql(
      `#graphql
      query {
        metaobjectDefinitions(first: 50) {
          edges {
            node {
              name
              type
            }
          }
        }
      }`,
    );

    const checkResult = await checkResponse.json();
    const definitions = checkResult?.data?.metaobjectDefinitions?.edges || [];
    const existsList = definitions.some(
      (edge: any) => edge.node.type === "instagram-list",
    );
    const existsPost = definitions.some(
      (edge: any) => edge.node.type === "instagram-post",
    );

    let createdList = false;
    let createdPost = false;
    let errors: string[] = [];

    // Create post definition if missing
    if (!existsPost) {
      const postResponse = await admin.graphql(MetaobjectDefinition, {
        variables: {
          definition: {
            name: "Instagram Post",
            type: "instagram-post",
            description: "A metaobject definition for Instagram posts",
            access: {
              storefront: "PUBLIC_READ",
            },
            capabilities: {
              publishable: {
                enabled: false,
              },
            },
            fieldDefinitions: [
              {
                key: "data",
                name: "Data",
                type: "json",
                required: true,
              },
              {
                key: "images",
                name: "Images",
                type: "list.file_reference",
              },
              {
                key: "caption",
                name: "Caption",
                type: "multi_line_text_field",
              },
              {
                key: "likes",
                name: "Likes",
                type: "number_integer",
              },
              {
                key: "comments",
                name: "Comments",
                type: "number_integer",
              },
            ],
          },
        },
      });

      const postResult = await postResponse.json();
      if (
        postResult?.data?.metaobjectDefinitionCreate?.userErrors?.length > 0
      ) {
        errors = errors.concat(
          postResult.data.metaobjectDefinitionCreate.userErrors.map(
            (err: any) => `${err.field?.join(".")}: ${err.message}`,
          ),
        );
        console.error("Metaobject post creation errors:", errors);
      } else if (
        postResult?.data?.metaobjectDefinitionCreate?.metaobjectDefinition
      ) {
        createdPost = true;
        console.log(
          "Metaobject post definition created:",
          postResult.data.metaobjectDefinitionCreate.metaobjectDefinition,
        );
      }
    }

    // Create list definition if missing
    if (!existsList) {
      // First, get the instagram-post definition ID
      const postDefQuery = await admin.graphql(
        `#graphql
        query {
          metaobjectDefinitions(first: 50) {
            edges {
              node {
                id
                type
              }
            }
          }
        }`,
      );

      const postDefResult = await postDefQuery.json();
      const postDef = postDefResult?.data?.metaobjectDefinitions?.edges?.find(
        (edge: any) => edge.node.type === "instagram-post",
      );

      if (!postDef) {
        errors.push(
          "Instagram Post definition must be created before Instagram List",
        );
        return {
          apiKey: process.env.SHOPIFY_API_KEY || "",
          existsList,
          existsPost,
          createdList,
          createdPost,
          errors,
        };
      }

      const postDefinitionId = postDef.node.id;

      const listResponse = await admin.graphql(MetaobjectDefinition, {
        variables: {
          definition: {
            name: "Instagram List",
            type: "instagram-list",
            description: "A metaobject definition for Instagram lists",
            access: {
              storefront: "PUBLIC_READ",
            },
            capabilities: {
              publishable: {
                enabled: false,
              },
            },
            fieldDefinitions: [
              {
                key: "data",
                name: "Data",
                type: "json",
                required: true,
              },
              {
                key: "posts",
                name: "Posts",
                type: "list.metaobject_reference",
                validations: [
                  {
                    name: "metaobject_definition_id",
                    value: postDefinitionId,
                  },
                ],
                required: true,
              },
              {
                key: "username",
                name: "Username",
                type: "single_line_text_field",
                required: true,
              },
              {
                key: "name",
                name: "displayName",
                type: "single_line_text_field",
                required: true,
              },
            ],
          },
        },
      });

      const listResult = await listResponse.json();
      if (
        listResult?.data?.metaobjectDefinitionCreate?.userErrors?.length > 0
      ) {
        errors = errors.concat(
          listResult.data.metaobjectDefinitionCreate.userErrors.map(
            (err: any) => `${err.field?.join(".")}: ${err.message}`,
          ),
        );
        console.error("Metaobject list creation errors:", errors);
      } else if (
        listResult?.data?.metaobjectDefinitionCreate?.metaobjectDefinition
      ) {
        createdList = true;
        console.log(
          "Metaobject list definition created:",
          listResult.data.metaobjectDefinitionCreate.metaobjectDefinition,
        );
      }
    }

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      existsList,
      existsPost,
      createdList,
      createdPost,
      errors,
    };
  } catch (error) {
    console.error("Error in metaobject definition creation:", error);
    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      exists: false,
      created: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function Index() {
  const { apiKey, existsList, existsPost, createdList, createdPost, errors } =
    useLoaderData<typeof loader>() as any;
  const navigate = useNavigate();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
      </s-app-nav>
      <Outlet />
      <div style={{ padding: "2rem" }}>
        <h1>Welcome to your app 🎉</h1>
        <p>This is the landing page of your Shopify app.</p>

        {/* Metaobject status */}
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            background: "#f5f5f5",
            borderRadius: "4px",
          }}
        >
          <h3>Metaobject Definition Status</h3>
          {existsList && !createdList && (
            <p>✅ Instagram List definition already exists</p>
          )}
          {createdList && (
            <p>✅ Instagram List definition created successfully!</p>
          )}

          {existsPost && !createdPost && (
            <p>✅ Instagram Post definition already exists</p>
          )}
          {createdPost && (
            <p>✅ Instagram Post definition created successfully!</p>
          )}
          {errors &&
            errors.length > 0 &&
            (() => {
              const errs: string[] = errors || [];
              return (
                <div style={{ color: "red" }}>
                  <p>❌ Errors:</p>
                  <ul>
                    {errs.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}
        </div>

        <div style={{ marginTop: "1rem" }}>
          <s-button variant="primary" onClick={() => navigate("/app")}>
            Go to App Dashboard
          </s-button>
        </div>
      </div>
    </AppProvider>
  );
}
