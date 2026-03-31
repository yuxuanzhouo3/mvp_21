const LEGACY_CONTRACT_ENTRYPOINTS = {
  create: "/create",
  new: "/create",
  uploadTemplate: "/create/import?method=screenshot&legacy=upload-template",
} as const;

export type LegacyContractEntrypoint = keyof typeof LEGACY_CONTRACT_ENTRYPOINTS;

// Legacy routes are now enforced through next.config redirects.
// Keep this map as the single source of truth for tests and historical links.
export function getLegacyContractEntrypointHref(
  entrypoint: LegacyContractEntrypoint,
) {
  return LEGACY_CONTRACT_ENTRYPOINTS[entrypoint];
}
