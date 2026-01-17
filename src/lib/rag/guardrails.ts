/**
 * Safety/guardrails for retrieval
 * 
 * Lightweight "retrieval policy" layer:
 * - Allowlist which source types can be retrieved
 * - Prevent cross-tenant leakage by construction
 */

export type AllowedSourceType = 'product' | 'page' | 'policy';

export interface RetrievalPolicy {
  allowedSourceTypes: AllowedSourceType[];
  requireExplicitAllowlist: boolean; // If true, only explicitly allowed types are permitted
}

/**
 * Default retrieval policy
 */
export const DEFAULT_RETRIEVAL_POLICY: RetrievalPolicy = {
  allowedSourceTypes: ['product', 'page', 'policy'],
  requireExplicitAllowlist: true,
};

/**
 * Validate retrieval request against policy
 */
export function validateRetrievalRequest(
  tenantId: string,
  siteId: string,
  requestedSourceTypes: AllowedSourceType[],
  policy: RetrievalPolicy = DEFAULT_RETRIEVAL_POLICY
): {
  valid: boolean;
  error?: string;
  allowedTypes: AllowedSourceType[];
} {
  // Ensure tenant_id and site_id are provided (prevent cross-tenant leakage)
  if (!tenantId || !siteId) {
    return {
      valid: false,
      error: 'tenant_id and site_id are required',
      allowedTypes: [],
    };
  }

  // Validate source types against allowlist
  if (policy.requireExplicitAllowlist) {
    const invalidTypes = requestedSourceTypes.filter(
      (type) => !policy.allowedSourceTypes.includes(type)
    );

    if (invalidTypes.length > 0) {
      return {
        valid: false,
        error: `Source types not allowed: ${invalidTypes.join(', ')}`,
        allowedTypes: policy.allowedSourceTypes,
      };
    }
  }

  // If no specific types requested, use all allowed types
  const allowedTypes =
    requestedSourceTypes.length > 0
      ? requestedSourceTypes
      : policy.allowedSourceTypes;

  return {
    valid: true,
    allowedTypes,
  };
}

/**
 * Sanitize source types (remove invalid types)
 */
export function sanitizeSourceTypes(
  requestedTypes: string[],
  policy: RetrievalPolicy = DEFAULT_RETRIEVAL_POLICY
): AllowedSourceType[] {
  return requestedTypes
    .filter((type): type is AllowedSourceType => {
      return (
        (type === 'product' || type === 'page' || type === 'policy') &&
        policy.allowedSourceTypes.includes(type as AllowedSourceType)
      );
    })
    .filter((type, index, self) => self.indexOf(type) === index); // Deduplicate
}

/**
 * Create a strict policy (only specified types allowed)
 */
export function createStrictPolicy(
  allowedTypes: AllowedSourceType[]
): RetrievalPolicy {
  return {
    allowedSourceTypes: allowedTypes,
    requireExplicitAllowlist: true,
  };
}

/**
 * Create a permissive policy (all types allowed)
 */
export function createPermissivePolicy(): RetrievalPolicy {
  return {
    allowedSourceTypes: ['product', 'page', 'policy'],
    requireExplicitAllowlist: false,
  };
}
