import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient;
}

const datasourceUrl = process.env.PRISMA_DATABASE_URL;

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      datasources: {
        db: {
          url: datasourceUrl,
        },
      },
    });
  }
}

const prisma =
  global.prismaGlobal ??
  new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  });

export default prisma;
