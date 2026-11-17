import { randomUUID } from "node:crypto";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";

export const catalogueStorage = new ObjectStorageService();
export function catalogueDestination(imageId: string) {
  const root = catalogueStorage.getPrivateObjectDir().replace(/^\/+|\/+$/g, "");
  const [bucketName, ...directory] = root.split("/");
  if (!bucketName || !directory.length) throw new Error("Catalogue storage is not configured.");
  const suffix = `catalogue/${imageId}/${randomUUID()}.webp`;
  return { objectPath: `/objects/${suffix}`, file: objectStorageClient.bucket(bucketName).file([...directory, suffix].join("/")) };
}
