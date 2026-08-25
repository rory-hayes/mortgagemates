export type ReadinessDocument = { requirement_id: string; status: string; created_at: string };

export function latestDocumentsByRequirement<T extends ReadinessDocument>(documents: T[]) {
  const latest = new Map<string, T>();
  [...documents]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .forEach((document) => {
      if (!latest.has(document.requirement_id)) latest.set(document.requirement_id, document);
    });
  return latest;
}

export function calculateReadiness(requiredIds: string[], documents: ReadinessDocument[]) {
  const latest = latestDocumentsByRequirement(documents);
  const requiredDocuments = requiredIds.map((id) => latest.get(id)).filter(Boolean) as ReadinessDocument[];
  const accepted = requiredDocuments.filter((document) => document.status === "accepted").length;
  const uploaded = requiredDocuments.length;
  return {
    accepted,
    uploaded,
    required: requiredIds.length,
    percent: requiredIds.length ? Math.round((accepted / requiredIds.length) * 100) : 0,
  };
}
