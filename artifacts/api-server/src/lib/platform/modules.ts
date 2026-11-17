export type Field = { key: string; label: string; type: string; required: boolean; options?: string[]; help?: string };
export type ModuleDefinition = {
  key: string; title: string; description: string; roles: string[]; createRoles: string[];
  fields: Field[]; transitions: Record<string, string[]>; reviewRoles?: string[]; initial: string;
};
const f = (key: string, label: string, type = "text", required = true, options?: string[], help?: string): Field =>
  ({ key, label, type, required, options, help });
const review = { draft: ["submitted", "cancelled"], submitted: ["approved", "rejected"], rejected: ["draft"], approved: ["archived"], cancelled: [], archived: [] };
const admin = ["administrator", "super-administrator"];
const farm = [...admin, "farm-manager"];
const expert = [...farm, "agronomist"];
const definition = (key: string, title: string, description: string, roles: string[], fields: Field[], transitions: Record<string, string[]> = review, createRoles = roles, reviewRoles = admin): ModuleDefinition =>
  ({ key, title, description, roles, createRoles, fields, transitions, reviewRoles, initial: Object.keys(transitions)[0]! });

export const modules: ModuleDefinition[] = [
  definition("farms", "Farms & agreements", "Farm authority and operational profiles. Approval requires recorded agreement review.", farm, [
    f("district", "District", "select", true, ["Madurai", "Dindigul", "Other"]),
    f("description", "Public farm story", "textarea"), f("operator", "Farm operator"),
    f("agreementReference", "Executed agreement reference"), f("agreementExpires", "Agreement valid until", "date"),
    f("address", "Internal farm address", "textarea"), f("emergencyContact", "Emergency contact"),
    f("waterSource", "Water source", "text", false), f("irrigation", "Irrigation system", "text", false),
    f("authorityReviewed", "I verified the executed authority document", "boolean"),
  ]),
  definition("zones", "Farm zones", "Organize authorized farms into zones, rows and blocks.", farm, [
    f("farmId", "Farm record ID"), f("description", "Zone, boundary and access notes", "textarea"),
    f("row", "Row / block", "text", false),
  ]),
  definition("trees", "Tree inventory", "Permanent identities, physical inspections and productive-stage verification.", [...expert, "farm-worker", "harvest-operator"], [
    f("farmId", "Farm record ID"), f("zone", "Farm zone"), f("treeCode", "Permanent Tree ID"),
    f("species", "Species", "select", true, ["Mango", "Guava", "Coconut"]),
    f("variety", "Variety"), f("description", "Public tree description", "textarea"),
    f("age", "Age and evidence/source", "text", false), f("productiveAssessment", "Productive-stage assessment", "textarea"),
    f("inspectedAt", "Inspection date", "date"), f("condition", "Current condition"),
    f("latitude", "Latitude (restricted)", "number", false), f("longitude", "Longitude (restricted)", "number", false),
    f("evidenceIds", "Four registration file IDs, comma separated", "textarea", true, undefined, "Full tree, trunk/label, canopy and identifying surroundings. Upload verification is required before approval."),
  ], {
    draft: ["inspection-pending", "retired"], "inspection-pending": ["approved", "draft", "suspended"],
    approved: ["available", "suspended", "retired"], available: ["temporarily-unavailable", "suspended", "retired"],
    "temporarily-unavailable": ["available", "suspended", "retired"], suspended: ["inspection-pending", "retired"], retired: [],
  }, farm, expert),
  definition("schemes", "Adoption schemes", "Versioned commercial drafts. Approval is gated until legal terms and dedicated checkout ledgers are implemented.", admin, [
    f("version", "Version", "number"), f("species", "Eligible species", "select", true, ["Mango", "Guava", "Coconut"]),
    f("feePaise", "Fee in paise", "number"), f("durationMonths", "Duration in months", "number"),
    f("entitlement", "Exact entitlement and calculation basis", "textarea"),
    f("fulfilment", "Fulfilment method", "select", true, ["pickup", "delivery", "sale-proceeds"]),
    f("disclosures", "Risks, inclusions, exclusions and remedies", "textarea"),
    f("agreementVersion", "Agreement version"), f("terms", "Approved agreement text", "textarea"),
  ]),
  definition("updates", "Tree updates", "Authentic, dated field observations subject to manager approval.", [...farm, "farm-worker", "content-manager"], [
    f("farmId", "Farm record ID"), f("treeId", "Tree record ID"),
    f("category", "Activity", "select", true, ["routine observation", "irrigation", "pruning", "soil care", "flowering", "fruit development", "pest/disease observation", "harvest", "weather impact", "farm visit"]),
    f("capturedAt", "Capture date", "date"), f("description", "Observation", "textarea"),
    f("evidenceIds", "Uploaded evidence file IDs", "textarea"),
  ], review, [...farm, "farm-worker"], [...farm, "content-manager"]),
  definition("tasks", "Field tasks", "Assigned work with review, evidence and recorded exceptions.", [...expert, "farm-worker"], [
    f("farmId", "Farm record ID"), f("treeId", "Tree record ID", "text", false),
    f("assigneeId", "Assigned worker user ID", "text", false),
    f("category", "Task type", "select", true, ["inspection", "irrigation", "pruning", "soil care", "pest/disease observation", "harvest preparation", "farm maintenance"]),
    f("dueDate", "Due date", "date"), f("instructions", "Instructions", "textarea"),
    f("completionNotes", "Completion / exception notes", "textarea", false),
    f("evidenceIds", "Evidence file IDs", "textarea", false),
  ], {
    planned: ["assigned", "cancelled"], assigned: ["accepted", "blocked", "cancelled"], accepted: ["in-progress", "blocked"],
    "in-progress": ["evidence-submitted", "delayed-by-weather", "blocked"], "delayed-by-weather": ["in-progress", "cancelled"],
    blocked: ["assigned", "cancelled"], "evidence-submitted": ["reviewed", "in-progress"], reviewed: ["completed"], completed: [], cancelled: [],
  }, farm, expert),
  definition("assessments", "Agronomy assessments", "Qualified observation and expert review; never autonomous prescribing.", expert, [
    f("farmId", "Farm record ID"), f("treeId", "Tree record ID"), f("observedAt", "Assessment date", "date"),
    f("observations", "Observations and symptoms", "textarea"), f("evidenceIds", "Evidence file IDs", "textarea", false),
    f("qualification", "Assessor qualification / reference"), f("followUpDate", "Follow-up date", "date", false),
  ], review, [...admin, "agronomist"], [...admin, "agronomist"]),
  definition("recommendations", "Care recommendations", "Expert drafts only. Customer-funded purchasing remains unavailable until explicit-consent commerce is connected.", expert, [
    f("farmId", "Farm record ID"), f("treeId", "Tree record ID"), f("assessmentId", "Approved assessment ID"),
    f("purpose", "Purpose", "textarea"), f("product", "Product / treatment"), f("dose", "Expert-approved dose and unit"),
    f("quantity", "Recommended quantity and unit"), f("method", "Application method", "textarea"),
    f("timing", "Timing"), f("pricePaise", "Optional itemized cost in paise", "number"),
    f("safety", "Safety precautions and statutory restrictions", "textarea"),
  ], review, [...admin, "agronomist"], [...admin, "agronomist"]),
  definition("products", "Product catalogue", "Approved product and safety records; no unsupported organic claims.", expert, [
    f("category", "Category"), f("manufacturer", "Manufacturer / brand"), f("composition", "Composition", "textarea"),
    f("approvedUse", "Approved use", "textarea"), f("packSize", "Pack size and unit"), f("storage", "Storage requirements"),
    f("safety", "Safety documentation reference"),
  ]),
  definition("batches", "Product batches", "Supplier, expiry and recall records. Stock movements and application-ledger controls are a subsequent milestone.", farm, [
    f("productId", "Approved product ID"), f("supplier", "Supplier"), f("batchNumber", "Batch / lot number"),
    f("purchasedAt", "Purchase date", "date"), f("expiresAt", "Expiry date", "date"),
    f("quantity", "Received quantity", "number"), f("unit", "Measurement unit"),
  ], { received: ["quarantined", "recalled"], quarantined: ["recalled"], recalled: [] }),
  definition("harvest", "Harvest observations", "Draft harvest capture only. Verified allocation and settlement ledgers are not yet enabled.", [...farm, "harvest-operator"], [
    f("farmId", "Farm record ID"), f("treeId", "Tree record ID"), f("harvestDate", "Harvest date", "date"),
    f("lotCode", "Lot reference"), f("grossQuantity", "Measured gross quantity", "number"),
    f("unit", "Measurement unit", "select", true, ["kg", "count"]), f("grade", "Grade"),
    f("rejectedQuantity", "Rejected quantity", "number"), f("retainedQuantity", "Retained quantity", "number"),
    f("weighingMethod", "Measurement method / equipment"), f("notes", "Loss reasons and observations", "textarea"),
  ]),
  definition("enquiries", "Gifting & enquiries", "Customer enquiries, occasion details and follow-up; no fabricated delivery confirmations.", [...admin, "support"], [
    f("kind", "Enquiry type", "select", true, ["adoption", "wedding", "personal", "corporate", "contact", "visit"]),
    f("name", "Name"), f("email", "Email"), f("phone", "Phone", "text", false),
    f("message", "Message", "textarea"), f("quantity", "Quantity", "number", false),
    f("budgetPaise", "Budget in paise", "number", false), f("eventDate", "Event date", "date", false),
    f("location", "Delivery location", "text", false), f("language", "Language", "select", false, ["en", "ta"]),
  ], { new: ["contacted", "closed"], contacted: ["closed"], closed: [] }, []),
  definition("tickets", "Support cases", "Customer-owned cases and staff triage. Support timers and threaded responses are tracked separately in the plan.", [...admin, "support", "customer"], [
    f("category", "Category", "select", true, ["adoption", "payment", "tree identity", "update", "harvest", "delivery", "nutrition", "gifting", "farm visit", "privacy", "complaint"]),
    f("severity", "Severity", "select", true, ["normal", "high", "urgent"]),
    f("description", "Describe your issue", "textarea"), f("resolution", "Staff resolution", "textarea", false),
  ], { open: ["in-progress", "escalated"], "in-progress": ["resolved", "escalated"], escalated: ["in-progress", "resolved"], resolved: ["reopened", "closed"], reopened: ["in-progress"], closed: [] }, [...admin, "support", "customer"], [...admin, "support"]),
  definition("articles", "Learning & content", "Publish reviewed educational articles without unsupported claims.", [...admin, "content-manager"], [
    f("category", "Category", "select", true, ["Seasons", "Soil", "Water", "Cultivation", "Responsible farming"]),
    f("excerpt", "Short introduction", "textarea"), f("body", "Article content", "textarea"),
    f("readingMinutes", "Reading time in minutes", "number"),
  ], { draft: ["published", "archived"], published: ["archived"], archived: [] }),
  definition("privacy-requests", "Privacy requests", "Access, correction and closure requests subject to approved retention obligations.", [...admin, "support", "customer"], [
    f("kind", "Request type", "select", true, ["access", "correction", "account-closure", "deletion"]),
    f("details", "Request details", "textarea"),
  ], { received: ["reviewing"], reviewing: ["completed", "retention-required"], "retention-required": ["reviewing"], completed: [] }, [...admin, "support", "customer"], admin),
];
export const moduleByKey = (key: string) => modules.find(m => m.key === key);
export const administratorRoles = admin;
