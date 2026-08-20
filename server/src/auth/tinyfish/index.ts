import type { Database } from "../../db/client";
import type { RoleRepository } from "../guards";
import { createDatabaseTinyFishProfileStore } from "./profiles";
import { createDatabaseTinyFishSessionStore } from "./sessions";
import { createTinyFishAuthService, type TinyFishAuthService } from "./service";
import { createTinyFishVerifier } from "./verify";

export {
  FIXTURE_CIMD,
  FIXTURE_ISSUER,
  PHASE1_FIXTURES,
  TINYFISH_PROVIDER_ID,
  TINYFISH_SESSION_COOKIE,
  TinyFishUnauthenticatedError,
  TinyFishUnavailableError,
  fixtureClaimsFor,
  isPhase1TinyFishToken,
  normalizeTinyFishToken,
  type TinyFishClaims,
} from "./claims";
export {
  createDatabaseTinyFishProfileStore,
  createMemoryTinyFishProfileStore,
  profileFromClaims,
  type TinyFishProfile,
  type TinyFishProfileStore,
} from "./profiles";
export {
  createDatabaseTinyFishSessionStore,
  createMemoryTinyFishSessionStore,
} from "./sessions";
export {
  createTinyFishAuthService,
  isTinyFishAuthError,
  type TinyFishAuthService,
} from "./service";
export { createTinyFishVerifier, type TinyFishVerifier } from "./verify";

export function createConfiguredTinyFishAuth(options: {
  database: Database;
  encryptionKey: string;
  mcpUrl: string;
  issuer?: string;
  roleRepository: RoleRepository;
}): TinyFishAuthService {
  return createTinyFishAuthService({
    verifier: createTinyFishVerifier({
      mcpUrl: options.mcpUrl,
      issuer: options.issuer,
    }),
    profiles: createDatabaseTinyFishProfileStore(options.database),
    sessions: createDatabaseTinyFishSessionStore(
      options.database,
      options.encryptionKey,
    ),
    rolesForUser: options.roleRepository.rolesForUser,
  });
}
