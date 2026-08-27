export type ReadinessDocument = {
  requirement_id: string;
  status: string;
  created_at: string;
  expiry_date?: string | null;
};

export function isAcceptedAndCurrent(document: ReadinessDocument | undefined, today = new Date()) {
  if (!document || document.status !== "accepted") return false;
  if (!document.expiry_date) return true;
  return document.expiry_date >= today.toISOString().slice(0, 10);
}

export function effectiveDocumentStatus(document: ReadinessDocument | undefined, today = new Date()) {
  if (!document) return "needed";
  if (document.status === "accepted" && !isAcceptedAndCurrent(document, today)) return "expired";
  return document.status;
}

export function latestDocumentsByRequirement<T extends ReadinessDocument>(documents: T[]) {
  const latest = new Map<string, T>();
  [...documents]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .forEach((document) => {
      if (!latest.has(document.requirement_id)) latest.set(document.requirement_id, document);
    });
  return latest;
}

export function calculateReadiness(requiredIds: string[], documents: ReadinessDocument[], today = new Date()) {
  const latest = latestDocumentsByRequirement(documents);
  const requiredDocuments = requiredIds.map((id) => latest.get(id)).filter(Boolean) as ReadinessDocument[];
  const accepted = requiredDocuments.filter((document) => isAcceptedAndCurrent(document, today)).length;
  const uploaded = requiredDocuments.length;
  return {
    accepted,
    uploaded,
    required: requiredIds.length,
    percent: requiredIds.length ? Math.round((accepted / requiredIds.length) * 100) : 0,
  };
}
