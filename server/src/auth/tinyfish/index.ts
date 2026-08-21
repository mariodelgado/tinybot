import type { Database } from "../../db/client";
import type { RoleRepository } from "../guards";
import { createDatabaseTinyFishProfileStore } from "./profiles";
import { createTinyFishAuthService, type TinyFishAuthService } from "./service";
import { createDatabaseTinyFishSessionStore } from "./sessions";
import { createTinyFishVerifier } from "./verify";

export {
  FIXTURE_CIMD,
  FIXTURE_ISSUER,
  fixtureClaimsFor,
  isPhase1TinyFishToken,
  normalizeTinyFishToken,
  PHASE1_FIXTURES,
  TINYFISH_PROVIDER_ID,
  TINYFISH_SESSION_COOKIE,
  type TinyFishClaims,
  TinyFishUnauthenticatedError,
  TinyFishUnavailableError,
} from "./claims";
export {
  applyTinyFishCredential,
  classifyTinyFishCredential,
  defaultHeaderForToken,
  incomingOfficialCredential,
  isTinyFishApiKey,
  isTinyFishMcpToken,
  liveClaimsFor,
  liveTinyFishUserId,
  OFFICIAL_TINYFISH_CLIENT,
  OFFICIAL_TINYFISH_ISSUER,
  OFFICIAL_TINYFISH_MCP_URL,
  OFFICIAL_TINYFISH_ORIGIN,
  presentationFromStoredValue,
  presentedCredentialFromHeaders,
  presentedCredentialFromSignIn,
  type TinyFishCredentialHeader,
  type TinyFishPresentedCredential,
} from "./credential";
export {
  createDatabaseTinyFishProfileStore,
  createMemoryTinyFishProfileStore,
  profileFromClaims,
  type TinyFishProfile,
  type TinyFishProfileStore,
} from "./profiles";
export {
  createTinyFishAuthService,
  isTinyFishAuthError,
  type TinyFishAuthService,
} from "./service";
export {
  createDatabaseTinyFishSessionStore,
  createMemoryTinyFishSessionStore,
} from "./sessions";
export { createTinyFishVerifier, type TinyFishVerifier } from "./verify";

export function createConfiguredTinyFishAuth(options: {
  database: Database;
  encryptionKey: string;
  mcpUrl: string;
  issuer?: string;
  roleRepository: RoleRepository;
  provisionSprite?: Parameters<
    typeof createTinyFishAuthService
  >[0]["provisionSprite"];
  sprites?: Parameters<typeof createTinyFishAuthService>[0]["sprites"];
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
    ...(options.provisionSprite
      ? { provisionSprite: options.provisionSprite }
      : {}),
    ...(options.sprites ? { sprites: options.sprites } : {}),
  });
}
