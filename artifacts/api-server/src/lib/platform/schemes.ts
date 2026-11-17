import { and, eq, inArray } from "drizzle-orm";
import { db, workflowRecords, type WorkflowRecord } from "@workspace/db";
import { CreateManagedSchemeBody, GetManagedSchemeResponse } from "@workspace/api-zod";
import type { z } from "zod";
import { isAdmin, PlatformError, type Actor } from "./access";

export type SchemeInput = z.infer<typeof CreateManagedSchemeBody>;
export type SchemeConfiguration = SchemeInput["configuration"];

export function requireSchemeAdmin(a: Actor): void {
  if (!isAdmin(a)) throw new PlatformError(403, "Global administrator access is required to customize schemes.");
}

export function schemeDTO(row: WorkflowRecord) {
  // Legacy or approved records must not be silently converted into editable drafts.
  if (!["draft", "approved", "archived"].includes(row.status) || !row.data.configuration) {
    throw new PlatformError(409, "This scheme cannot be edited as a draft. Its existing record must be reviewed separately.");
  }
  return GetManagedSchemeResponse.parse({
    id: row.id, name: row.title, configuration: row.data.configuration,
    version: row.version, status: row.status,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  });
}

export function schemeSnapshot(row: WorkflowRecord): Record<string, unknown> {
  const { name, configuration, version, status } = schemeDTO(row);
  return { name, configuration, version, status };
}

export function validateSchemeConfiguration(c: SchemeConfiguration): void {
  if (new Set(c.treeIds).size !== c.treeIds.length) throw new PlatformError(400, "Select each tree only once.");
  if (new Set(c.fulfilmentMethods).size !== c.fulfilmentMethods.length) throw new PlatformError(400, "Select each fulfilment method only once.");
  if (c.treeIds.length && !c.farmId) throw new PlatformError(400, "Choose a farm before assigning trees.");
  if (c.allocationType === "fixed-quantity" && (c.quantity === null || c.quantity <= 0)) {
    throw new PlatformError(400, "A fixed-quantity scheme needs a positive harvest quantity.");
  }
  if (c.quantity !== null && (c.quantity <= 0 || (c.unit === "count" && !Number.isInteger(c.quantity)))) {
    throw new PlatformError(400, "Harvest quantity must be positive; a count must be a whole number.");
  }
  if (c.sharePercent <= 0 || c.sharePercent > 100) throw new PlatformError(400, "Harvest share must be greater than zero and at most 100 percent.");
  if (c.allocationType === "exclusive-harvest" && (c.sharePercent !== 100 || c.maxAdopters !== 1)) {
    throw new PlatformError(400, "A full-harvest scheme has a 100 percent share and one adopter per tree.");
  }
  if (c.allocationType === "sale-proceeds" && !c.fulfilmentMethods.includes("sale-settlement")) {
    throw new PlatformError(400, "A sale-proceeds scheme must allow harvest-sale settlement.");
  }
  for (const value of [c.enrollmentStart, c.enrollmentEnd]) {
    if (value === null) continue;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
      throw new PlatformError(400, "Enrollment dates must be real calendar dates in YYYY-MM-DD format.");
    }
  }
  if (c.enrollmentStart && c.enrollmentEnd && c.enrollmentEnd < c.enrollmentStart) {
    throw new PlatformError(400, "Enrollment must end on or after its starting date.");
  }
}

export async function validateSchemeReferences(c: SchemeConfiguration, archived = false): Promise<void> {
  if (!c.farmId) return;
  const [farm] = await db.select().from(workflowRecords).where(and(eq(workflowRecords.id, c.farmId), eq(workflowRecords.module, "farms")));
  if (!farm) throw new PlatformError(400, "The selected farm no longer exists.");
  if (!archived && farm.status === "archived") throw new PlatformError(400, "Restore the selected farm or choose another farm.");
  if (!c.treeIds.length) return;
  const trees = await db.select().from(workflowRecords).where(and(eq(workflowRecords.module, "trees"), inArray(workflowRecords.id, c.treeIds)));
  if (trees.length !== c.treeIds.length) throw new PlatformError(400, "One or more selected trees no longer exist.");
  for (const tree of trees) {
    if (tree.farmId !== c.farmId) throw new PlatformError(400, "All selected trees must belong to the chosen farm.");
    if (!archived && tree.status === "archived") throw new PlatformError(400, "Remove archived trees before saving the draft.");
    if (tree.data.species !== c.species) throw new PlatformError(400, "Selected trees must match the scheme's species.");
    if (c.variety.trim() && String(tree.data.variety ?? "").trim().toLowerCase() !== c.variety.trim().toLowerCase()) {
      throw new PlatformError(400, "Selected trees must match the scheme's variety.");
    }
  }
  // Sample trees are valid for private configuration only. Saving a draft never
  // changes inventory provenance, public adoption eligibility or payment access.
}
