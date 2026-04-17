import { CLOUDBASE_COLLECTIONS } from "@/lib/database/cloudbase-schema";

type CloudBaseCollectionHandle = {
  limit: (count: number) => {
    get: () => Promise<unknown>;
  };
};

type CloudBaseDatabaseLike = {
  collection: (name: string) => CloudBaseCollectionHandle;
  createCollection: (name: string) => Promise<unknown>;
};

const ensuredCollections = new Set<string>();
const ensuringCollections = new Map<string, Promise<void>>();

function isCloudbaseMissingCollectionError(error: unknown) {
  const message = String((error as { message?: string })?.message || "");
  const code = String((error as { code?: string })?.code || "");

  return (
    message.includes("Db or Table not exist") ||
    message.includes("DATABASE_COLLECTION_NOT_EXIST") ||
    code.includes("DATABASE_COLLECTION_NOT_EXIST")
  );
}

export async function ensureCloudbaseCollection(
  db: CloudBaseDatabaseLike,
  collectionName: string,
) {
  if (ensuredCollections.has(collectionName)) {
    return;
  }

  const inFlight = ensuringCollections.get(collectionName);
  if (inFlight) {
    await inFlight;
    return;
  }

  const ensurePromise = (async () => {
    try {
      await db.collection(collectionName).limit(1).get();
      ensuredCollections.add(collectionName);
      return;
    } catch (error) {
      if (!isCloudbaseMissingCollectionError(error)) {
        throw error;
      }
    }

    await db.createCollection(collectionName);
    ensuredCollections.add(collectionName);
  })();

  ensuringCollections.set(collectionName, ensurePromise);
  try {
    await ensurePromise;
  } finally {
    ensuringCollections.delete(collectionName);
  }
}

export async function ensurePasswordResetCollections(db: CloudBaseDatabaseLike) {
  await Promise.all([
    ensureCloudbaseCollection(db, CLOUDBASE_COLLECTIONS.EMAIL_VERIFICATION_CODES),
    ensureCloudbaseCollection(db, CLOUDBASE_COLLECTIONS.PASSWORD_RESET_TOKENS),
  ]);
}

