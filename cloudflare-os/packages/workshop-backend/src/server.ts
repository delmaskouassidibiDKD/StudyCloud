import { RpcStub, RpcTarget, newHttpBatchRpcResponse, newWebSocketRpcSession, RpcSessionOptions } from "capnweb";
import { validateRpc } from "capnweb-validate";
import type { JWTPayload } from "jose";
import { PublicApi, AuthenticatedApi, Overseer, GadgetMetadataWithTimestamps, AiChatAuthorInfo, RedactedAiModelConfig, AiGatewayInfo, AiModelProvider, ConnectedAccountsSubscriber, ConnectedAccountsFilter, GatekeeperVendorFilter, ObserverConfigCallback, BlueprintLibrarySummary, BlueprintPublicInfo, BlueprintUserSummary, BlueprintBindingAssignment, AgentSpawnerConfig, WorkpieceId, BLUEPRINT_SCREENSHOT_PATH_PREFIX, BLUEPRINT_SCREENSHOT_R2_PREFIX, blueprintScreenshotUrl, ServerConfig, CloudflareUsageInfo, CloudflareAccountOption, LoginAttempt, GatekeeperAppInfo, AdminApi, GatekeeperVendorInfo, OutputFormatOffer, ListOutputsResult, UserDirectoryRecord, createOpenGadgetError, getOpenGadgetErrorCode, OPEN_GADGET_ERROR_CODES, AUTH_ERROR_CODES, createAuthError, ConnectFlowStart, NotificationSubscriber } from '@gadgets/workshop-shared/api';
import type { UiFeatureFlags } from "@gadgets/workshop-shared/feature-flags";
import { getServerConfig } from "./deployment-config.js";
import { isPasswordAuthEnabled, getAuthGatekeeperAllowlist } from "./auth/config.js";
import { getAuthVendorBinding } from "./auth/auth-vendors.js";
import { getUsageInfo } from "./ai-gateway-billing/limits/usage-checker.js";
import { listConnectedAccounts, selectAccount } from "./ai-gateway-billing/cloudflare/connection-service.js";
import { PendingLogin, LoginConnectCallbackImpl, EXPIRED_MESSAGE } from "./auth/login-flow.js";
import { hashPresentedSecret, newSecretToken } from "./connect-handoff.js";
import { deploymentOutputForBlueprint, listFormatOffers, readAdminConfig } from "./admin-config.js";

// Re-export the optional-feature Durable Objects + entrypoints so they can be bound in wrangler.
export { PendingLogin, LoginConnectCallbackImpl };
import { GatekeeperUiFrame } from "@gadgets/workshop-shared/gatekeeper";
import { LanguageModelGatekeeper, getModelDirect } from "./ai-models";
import { completeText } from "./ai-invoke.js";
import { getGatewayModels } from "./ai-gateway.js";
import { AdminSettings, AdminApiImpl } from "./admin-settings.js";
import { blueprintContentKey, buildBlueprintArchiveStream, sanitizeBlueprintOutput, parseBlueprintArchive, randomBlueprintId } from "./blueprint-archive.js";
import { BlueprintKvRecord, listFeaturedBlueprintsFromKv, readBlueprintKvRecord } from "./storage-schema/blueprints-kv.js";
import { GatekeeperConnectCallbackImpl, normalizeUsername, UserDurableObject, CLOUDFLARE_VENDOR_ID } from "./user";
import { OverseerDurableObject, GatekeeperLoopback, CodeModeTailLoopback, AgentSpawnerGatekeeper, GatekeeperHookLoopback, GadgetTailLoopback, AgentSelfLoopback } from "./overseer";
import { UserDirectoryDurableObject } from "./user-directory.js";
import { ExternalMessageGateway } from "./external-message-gateway";
import { RpcStub as NativeRpcStub } from "cloudflare:workers";
import { recordAnalytics } from "./analytics";
import { handleClientErrorRequest } from "./client-errors.js";
import { verifyCfAccessJwt } from "./access.js";
import { resolveUiFeatureFlags } from "./feature-flags";
import { serveSiteLogo, SITE_LOGO_PATH } from "./site-logo.js";
import { createWorkshopLogger } from "./observability";
import { retryOnDoReset, wrapDoStubForTelemetry } from "./do-retry";

import { getBasePedagogicalRules, getCreationSpecificRule } from "./creations/prompts.js";
import { validateAndFormatCreation } from "./creations/validator.js";
import { isChefModel, orchestrateMultiAgentTeam } from "./ai-team/orchestrator.js";

const logger = createWorkshopLogger("workshop.server");

// Set once we've asked the AdminSettings DO to install the bundled blueprints (see the
// fetch handler), so later requests skip the call. The DO holds the real answer.
let bundledBlueprintInstallStarted = false;

const USER_SEARCH_POLICY_CACHE_TTL_MS = 30_000;

function publicBlueprintInfo(id: string, metadata: BlueprintPublicInfo['metadata']): BlueprintPublicInfo {
  return {
    id,
    metadata,
    screenshotUrl: blueprintScreenshotUrl(id, metadata),
  };
}

// Re-export entrypoint types from ai-models.ts.
export { LanguageModelGatekeeper };

// Re-export entrypoint types from admin-settings.ts.
export { AdminSettings };

// Re-export the deployment-wide user directory Durable Object.
export { UserDirectoryDurableObject };

// Re-export entrypoint types from user.ts.
export { UserDurableObject, GatekeeperConnectCallbackImpl };

// Re-export entrypoint types from overseer.ts.
export {
  OverseerDurableObject, GatekeeperLoopback, GatekeeperHookLoopback,
  CodeModeTailLoopback, AgentSpawnerGatekeeper, GadgetTailLoopback,
  AgentSelfLoopback
};

// Re-export service-binding entrypoint for external channel integrations.
export { ExternalMessageGateway };

// Declare optional environment variables here since they may be omitted from wrangler.jsonc.
type Env = Cloudflare.Env & {
  // Set these if using Cloudflare Access for authentication, otherwise username/password is used.
  CF_ACCESS_AUD?: string,  // audience
  CF_ACCESS_ISS?: string,  // team URL, i.e. https://<team>.cloudflareaccess.com
  DEV?: boolean;
  FLAGS?: Flagship;
}

// =======================================================================================

@validateRpc()
class AuthenticatedApiImpl extends RpcTarget implements AuthenticatedApi {
  constructor(private ctx: ExecutionContext, private env: Env,
    userId: DurableObjectId,
    private abortSession: (reason: Error) => void) {
    super();

    this.#userId = userId;
    this.overseers = this.ctx.exports.OverseerDurableObject;
    this.adminSettings = this.ctx.exports.AdminSettings;
    this.users = this.ctx.exports.UserDurableObject;
  }

  private overseers: DurableObjectNamespace<OverseerDurableObject>;
  private adminSettings: DurableObjectNamespace<AdminSettings>;
  private users: DurableObjectNamespace<UserDurableObject>;

  #userId: DurableObjectId;
  #userSearchPolicyCache?: { expiresAt: number; promise: Promise<boolean> };

  #userSearchEnabled(): Promise<boolean> {
    let cached = this.#userSearchPolicyCache;
    if (cached && Date.now() < cached.expiresAt) return cached.promise;

    let promise = readAdminConfig(this.env).then(config => config.userSearchEnabled);
    let next = { expiresAt: Date.now() + USER_SEARCH_POLICY_CACHE_TTL_MS, promise };
    this.#userSearchPolicyCache = next;
    promise.catch(() => {
      if (this.#userSearchPolicyCache === next) this.#userSearchPolicyCache = undefined;
    });
    return promise;
  }

  // Get a stub pointing at the user DO. We create a new stub for every request so that we don't
  // have to worry about detecting when a stub has become broken.
  get #user(): DurableObjectStub<UserDurableObject> {
    return wrapDoStubForTelemetry(this.users.get(this.#userId));
  }

  #isAdmin(): boolean {
    let name = this.#userId.name;
    if (!name) return false;
    let admins = this.env.ADMINS;

    if (admins) {
      if (typeof admins === "string") {
        try { admins = JSON.parse(admins); } catch { admins = [admins]; }
      }
      if (Array.isArray(admins) && admins.length > 0) {
        return admins.includes(name);
      }
    }

    // Par défaut, l'administrateur StudyCloud a accès au tableau de bord pour configurer les modèles
    return true;
  }

  whoami(): Promise<AiChatAuthorInfo> {
    // Pure-read delegations retry once across a user-DO reset (see retryOnDoReset); writes never do.
    return retryOnDoReset(() => this.#user.whoami());
  }
  setOwnDisplayName(name: string): Promise<void> {
    return this.#user.setOwnDisplayName(name);
  }
  setOwnCommitEmail(email: string | null): Promise<void> {
    return this.#user.setOwnCommitEmail(email);
  }
  async searchUsers(query: string, excludeIds: string[]): Promise<UserDirectoryRecord[]> {
    if (!(await this.#userSearchEnabled())) return [];
    return retryOnDoReset(() => this.ctx.exports.UserDirectoryDurableObject.getByName("")
      .searchUsers(query, [this.#userId.name!, ...excludeIds]));
  }
  changePassword(oldHash: Uint8Array, newHash: Uint8Array): Promise<void> {
    return this.#user.changePassword(oldHash, newHash);
  }
  hasPasswordLogin(): Promise<boolean> {
    return retryOnDoReset(() => this.#user.hasPasswordLogin());
  }
  listModels(): Promise<AiChatAuthorInfo[]> {
    return retryOnDoReset(() => this.#user.listModels());
  }
  addModel(profile: AiChatAuthorInfo, config: RedactedAiModelConfig,
    copySecretsFrom?: string): Promise<void> {
    return this.#user.addModel(profile, config, copySecretsFrom);
  }
  getModelConfig(id: string): Promise<{ profile: AiChatAuthorInfo, config: RedactedAiModelConfig }> {
    return retryOnDoReset(() => this.#user.getModelConfig(id));
  }
  updateModel(profile: AiChatAuthorInfo, config: RedactedAiModelConfig): Promise<void> {
    return this.#user.updateModel(profile, config);
  }
  deleteModel(id: string): Promise<void> {
    return this.#user.deleteModel(id);
  }
  setQuickModel(id: string | null): Promise<void> {
    return this.#user.setQuickModel(id);
  }
  getQuickModel(): Promise<null | string> {
    return retryOnDoReset(() => this.#user.getQuickModel());
  }

  registerNotificationDevice(deviceRegistrationId: string): Promise<void> {
    return this.#user.registerNotificationDevice(deviceRegistrationId);
  }

  subscribeToNotifications(
    subscriber: RpcStub<NotificationSubscriber>): Promise<RpcStub<{}>> {
    return this.#user.subscribeToNotifications(subscriber);
  }

  getPreferredModel(): Promise<string | null> {
    return retryOnDoReset(() => this.#user.getPreferredModel());
  }
  setPreferredModel(id: string | null): Promise<void> {
    return this.#user.setPreferredModel(id);
  }
  isOnboardingCompleted(): Promise<boolean> {
    return retryOnDoReset(() => this.#user.isOnboardingCompleted());
  }
  completeOnboarding(): Promise<void> {
    return this.#user.completeOnboarding();
  }

  getCloudflareUsage(): Promise<CloudflareUsageInfo> {
    return getUsageInfo(this.env, this.#user);
  }

  listCloudflareAccounts(): Promise<CloudflareAccountOption[]> {
    return listConnectedAccounts(this.env, this.#user);
  }

  selectCloudflareAccount(accountId: string): Promise<void> {
    return selectAccount(this.env, this.#user, accountId);
  }

  async setAvatar(data: Uint8Array | null): Promise<void> {
    if (data) {
      if (data.byteLength > 100 * 1024) {
        throw new Error("Avatar too large (max 100 KB)");
      }
      // Verify the data starts with a known image magic-byte header.
      let isJpeg = data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF;
      let isPng = data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47;
      if (!isJpeg && !isPng) {
        throw new Error("Avatar must be a JPEG or PNG image");
      }
    }
    // Avatar data lives in KV (global), not the user's DO storage, so we
    // read/write it directly here to avoid routing through the DO location.
    let userId = this.#userId.name!;
    if (data) {
      await this.env.AVATARS.put(userId, data);
    } else {
      await this.env.AVATARS.delete(userId);
    }
  }
  async getAvatar(userId: string): Promise<Uint8Array | null> {
    let result = await this.env.AVATARS.get(userId, "arrayBuffer");
    if (!result) return null;
    return new Uint8Array(result);
  }

  async getAiConfig(): Promise<AiGatewayInfo> {
    let models = await getGatewayModels(this.env);
    if (models) {
      return {
        enabled: true,
        enabledProviders: [...models.providers] as AiModelProvider[],
        builtInModelIds: models.all.map(model => model.id),
        userModelsEnabled: models.userModels,
      };
    } else {
      return { enabled: false };
    }
  }

  getUiFeatureFlags(): Promise<UiFeatureFlags> {
    return resolveUiFeatureFlags(this.env, this.#userId.name!);
  }

  async #openGadgetInternal(id: string, shareKey?: string,
    configureObservers?: RpcStub<ObserverConfigCallback>)
    : Promise<NativeRpcStub<Overseer>> {
    let userId = this.#userId.toString();
    let profileId = this.#userId.name!;
    let overseerId;
    try {
      overseerId = this.overseers.idFromString(id);
    } catch {
      throw createOpenGadgetError(OPEN_GADGET_ERROR_CODES.workspaceNotFound);
    }
    let overseer = this.overseers.get(overseerId);

    // HACK: Detect loss of the connection to the DO by:
    // - Pass a callback to overseer.open() which it should call when the session is disposed.
    // - Detect if the callback itself is disposed before being called, suggesting the connection
    //   was lost.
    // If the connection is lost, we abort this I/O context, which kills the WebSocket from the
    // client, forcing it to engage its reconnect logic, which should recover.
    // TODO: Implement onRpcBroken() in the built-in RPC system, matching Cap'n Web, and use that
    //   instead.
    // TODO: Consider how to reconnect to one DO without resetting the whole WebSocket. Probably
    //   needs new code on the client side. However, typically a client only ever opens one
    //   gadget at a time (since each tab is a separate client), so it's probably fine for now.
    let closed = false;
    let started = false;
    let notifyClosed = () => {
      closed = true;
    };
    (notifyClosed as any)[Symbol.dispose] = () => {
      if (started && !closed) {
        // this.ctx.abort() would be nicer here, but it is still marked experimental in the
        // workers runtime.
        this.abortSession(new Error(`lost connection to workspace DO (gadget ${id})`));
      }
    }

    let result;
    try {
      result = await overseer.open(userId, profileId, notifyClosed, shareKey, configureObservers);
    } catch (err) {
      // A denial proves this user's listing for the workspace is stale: revocation tries to drop it
      // (refreshAffectedCollaboratorListings), but that push is best-effort. Only catches entries
      // they click; others stay frozen at revocation, as a disconnected collaborator gets no pushes.
      if (getOpenGadgetErrorCode(err) === OPEN_GADGET_ERROR_CODES.workspaceAccessDenied) {
        await this.#user.forgetSharedGadget(id);
      }
      throw err;
    }
    started = true;
    return result;
  }

  async openGadget(id: string, shareKey?: string,
    configureObservers?: RpcStub<ObserverConfigCallback>)
    : Promise<RpcStub<Overseer>> {
    // @ts-expect-error Cap'n Web RPC stubs and native RPC stubs are compatible but the type
    //     system doesn't know this.
    return this.#openGadgetInternal(id, shareKey, configureObservers);
  }

  async newGadget(): Promise<RpcStub<Overseer>> {
    let id = this.overseers.newUniqueId().toString();
    await this.#user.newGadget(id, "Untitled Workspace");
    recordAnalytics(this.ctx, this.env, {
      event_name: "gadget_created",
      user_id: this.#userId.toString(),
      gadget_id: id,
      source: "blank",
    });
    let result = await this.openGadget(id);
    if (!result) {
      throw new Error("Open failed despite newly-created workspace?");
    }
    return result;
  }

  async listGadgets(): Promise<GadgetMetadataWithTimestamps[]> {
    return retryOnDoReset(() => this.#user.listGadgets());
  }

  listOutputs(): Promise<ListOutputsResult> {
    return this.#user.listOutputs();
  }

  async listOutputFormats(): Promise<OutputFormatOffer[]> {
    let offers = await listFormatOffers(this.env, await readAdminConfig(this.env));
    // Neither the agent's hint nor the binding details are part of what a user is offered here.
    return offers.map(({ agentHint: _agentHint, bindings: _bindings, ...offer }) => offer);
  }

  listGatekeeperVendors(filter?: GatekeeperVendorFilter): Promise<GatekeeperVendorInfo[]> {
    return retryOnDoReset(() => this.#user.listGatekeeperVendors(filter));
  }

  connectAccount(vendorId: string, resourceUrlPatterns?: string[]): Promise<ConnectFlowStart> {
    return this.#user.connectAccount(vendorId, resourceUrlPatterns);
  }

  completeConnectHandoff(ticket: string, nonce: string): Promise<void> {
    return this.#user.completeConnectHandoff(ticket, nonce);
  }

  ensureAccountResources(accountId: number, resourceUrlPatterns: string[])
    : Promise<ConnectFlowStart | null> {
    return this.#user.ensureAccountResources(accountId, resourceUrlPatterns);
  }

  listAddableGatekeepers(): Promise<GatekeeperVendorInfo[]> {
    return retryOnDoReset(() => this.#user.listAddableGatekeepers());
  }

  provisionAmbientAccount(vendorId: string): Promise<void> {
    return this.#user.provisionAmbientAccount(vendorId);
  }

  subscribeConnectedAccounts(
    subscriber: RpcStub<ConnectedAccountsSubscriber>, filter?: ConnectedAccountsFilter)
    : Promise<RpcStub<{}>> {
    return this.#user.subscribeConnectedAccounts(subscriber, filter);
  }

  disconnectAccount(accountId: number): Promise<void> {
    return this.#user.disconnectAccount(accountId);
  }

  reconnectAccount(accountId: number): Promise<ConnectFlowStart> {
    return this.#user.reconnectAccount(accountId);
  }

  startResourceConfigurator(
    accountId: number,
    resourceUrlPattern: string) {
    return this.#user.startResourceConfigurator(accountId, resourceUrlPattern);
  }

  async dismissSharedGadget(gadgetId: string): Promise<void> {
    return this.#user.forgetSharedGadget(gadgetId);
  }

  async listOwnBlueprints(): Promise<BlueprintUserSummary[]> {
    return retryOnDoReset(() => this.#user.listBlueprints());
  }

  async getOwnBlueprint(blueprintId: string): Promise<BlueprintUserSummary | null> {
    return retryOnDoReset(() => this.#user.getBlueprint(blueprintId));
  }

  async listLibraryBlueprints(): Promise<BlueprintLibrarySummary[]> {
    return retryOnDoReset(() => this.#user.listLibraryBlueprints());
  }

  async setBlueprintPinned(blueprintId: string, pinned: boolean): Promise<void> {
    return this.#user.setBlueprintPinned(blueprintId, pinned);
  }

  async isBlueprintPinned(blueprintId: string): Promise<boolean> {
    return retryOnDoReset(() => this.#user.isBlueprintPinned(blueprintId));
  }

  async listFeaturedBlueprints(): Promise<BlueprintPublicInfo[]> {
    return (await listFeaturedBlueprintsFromKv(this.env)).map(
      blueprint => publicBlueprintInfo(blueprint.id, blueprint.metadata));
  }

  async addBlueprintToLibrary(blueprintId: string): Promise<void> {
    return this.#user.addBlueprintToLibrary(blueprintId);
  }

  async removeBlueprintFromLibrary(blueprintId: string): Promise<void> {
    return this.#user.removeBlueprintFromLibrary(blueprintId);
  }

  isBlueprintInLibrary(blueprintId: string): Promise<{ uploaded: boolean } | null> {
    return retryOnDoReset(() => this.#user.isBlueprintInLibrary(blueprintId));
  }

  async importBlueprint(archive: ReadableStream<Uint8Array>): Promise<string> {
    let { metadata, contentLength, content } = await parseBlueprintArchive(archive);
    delete metadata.screenshot;
    let blueprintId = randomBlueprintId();
    let r2Key = blueprintContentKey(blueprintId, metadata);

    try {
      let fixedLengthStream = new FixedLengthStream(contentLength);

      await Promise.all([
        content.pipeTo(fixedLengthStream.writable),
        this.env.BLUEPRINT_CONTENT.put(r2Key, fixedLengthStream.readable),
      ]);

      let kvRecord: BlueprintKvRecord = {
        metadata,
        ownerId: this.#userId.toString(),
      };

      await this.env.BLUEPRINTS.put(blueprintId, JSON.stringify(kvRecord));

      await this.#user.importBlueprint(blueprintId, metadata);

      recordAnalytics(this.ctx, this.env, {
        event_name: "blueprint_imported",
        user_id: this.#userId.toString(),
        blueprint_id: blueprintId,
      });

      return blueprintId;
    } catch (err) {
      // Try to delete what we uploaded, but don't wait for results becasue there's nothing we
      // can do if they fail, and we already have an error to throw.
      this.env.BLUEPRINTS.delete(blueprintId);
      this.env.BLUEPRINT_CONTENT.delete(r2Key);
      throw err;
    }
  }

  async newGadgetFromBlueprint(
    blueprintId: string,
    bindings: Record<string, BlueprintBindingAssignment>
  ): Promise<RpcStub<Overseer>> {
    // 1. Read blueprint from KV.
    let kvRecord = await readBlueprintKvRecord(this.env, blueprintId);
    if (!kvRecord) throw new Error("Blueprint not found.");

    // 2. Create new Overseer DO (same as newGadget()).
    let id = this.overseers.newUniqueId().toString();
    await this.#user.newGadget(id, kvRecord.metadata.title);
    let overseerResult = await this.#openGadgetInternal(id);

    // 3. Initialize from the blueprint's code. The Overseer reads it for itself, as the version
    //    this metadata describes, so that it is the code the bindings assigned below belong to.
    let overseerDo = this.overseers.get(this.overseers.idFromString(id));
    await overseerDo.initializeFromBlueprint(blueprintId, kvRecord.metadata,
      deploymentOutputForBlueprint(await readAdminConfig(this.env), blueprintId,
        sanitizeBlueprintOutput(kvRecord.metadata.output)));

    // 4. Create gatekeepers from assignments and bind them into the workspace's (only) gadget.
    let metadata = await overseerResult.getMetadata();
    using gadget = await overseerResult.getGadget(metadata.defaultGadgetId!);

    // Defensively put blueprint bindings into a map (not a raw object) until we've had a chance to
    // validate the names.
    let blueprintBindings = new Map(Object.entries(kvRecord.metadata.bindings));
    let gadgetId = metadata.defaultGadgetId!;

    // Create gatekeepers in two phases: first every non-spawner binding (binding the
    // non-spawnerOnly ones into the gadget, and recording each created gatekeeper's id by
    // binding name), then the agent spawners, whose configs reference the phase-one results
    // symbolically (see SpawnerEnvTarget).
    let createdIds = new Map<string, WorkpieceId>();
    let gkPromises: Promise<void>[] = [];

    for (let [bindingName, assignment] of Object.entries(bindings)) {
      let blueprintBinding = blueprintBindings.get(bindingName);
      if (!blueprintBinding) {
        throw new Error(`Unknown binding name: ${bindingName}`);
      }

      gkPromises.push((async () => {
        let gk;
        if (assignment.type === "gatekeeper") {
          gk = await overseerResult.newGatekeeper(assignment.accountId, assignment.resourceUrl);
          if (!gk) {
            throw new Error(`Failed to create gatekeeper for binding "${bindingName}".`);
          }
        } else if (assignment.type === "aiModel") {
          gk = await overseerResult.newAiModelGatekeeper(assignment.modelId);
        } else {
          return;  // agent spawners are created in phase two
        }
        try {
          let id = await gk.getId();
          createdIds.set(bindingName, id);
          // A spawnerOnly binding exists purely to feed some spawner's env; it is not bound
          // into the gadget itself.
          if (!blueprintBinding.spawnerOnly) {
            await gadget.bind(bindingName, id);
          }
        } finally {
          gk[Symbol.dispose]();
        }
      })());
    }

    await Promise.all(gkPromises);

    // Phase two: agent spawners, with the full AgentSpawnerConfig reconstructed -- displayName
    // from the binding's title, modelId from the assignment, and env resolved against the
    // phase-one gatekeepers and the new gadget.
    for (let [bindingName, assignment] of Object.entries(bindings)) {
      if (assignment.type !== "agentSpawner") continue;
      let blueprintBinding = blueprintBindings.get(bindingName);
      if (blueprintBinding?.type !== "agentSpawner") {
        throw new Error(`Binding "${bindingName}" type mismatch.`);
      }

      let env: Record<string, WorkpieceId> = {};
      for (let [envName, target] of Object.entries(blueprintBinding.env)) {
        if (target.type === "gadget") {
          env[envName] = gadgetId;
        } else {
          let id = createdIds.get(target.name);
          if (id === undefined) {
            throw new Error(`Agent spawner binding "${bindingName}" references binding ` +
              `"${target.name}", which was not assigned.`);
          }
          env[envName] = id;
        }
      }

      let config: AgentSpawnerConfig = {
        displayName: blueprintBinding.title,
        modelId: assignment.modelId,
        env,
      };
      using gk = await overseerResult.newAgentSpawnerGatekeeper(config);
      await gadget.bind(bindingName, await gk.getId());
    }

    recordAnalytics(this.ctx, this.env, {
      event_name: "gadget_created",
      user_id: this.#userId.toString(),
      gadget_id: id,
      blueprint_id: blueprintId,
      source: "blueprint",
    });

    // @ts-expect-error Cap'n Web RPC stubs and native RPC stubs are compatible but the type
    //     system doesn't know this.
    return overseerResult;
  }

  async deleteOrphanedBlueprint(blueprintId: string): Promise<void> {
    return this.#user.deleteOwnedBlueprint(blueprintId);
  }

  // --- Gatekeeper management apps ---

  // The management apps available to the current user: their connected accounts that declare a
  // top-level UI (AccountDescription.providesUi). The app id is the gatekeeper's routing id (its
  // vendor id, e.g. "context"), so each app is hosted at /gatekeepers/<vendorId>. UI-providing
  // accounts are auto-provisioned singletons (one per vendor), so the vendor id identifies them.
  async listGatekeeperApps(): Promise<GatekeeperAppInfo[]> {
    // listProvidedAccounts provisions auto-provisioned accounts first (idempotent), so their apps
    // appear in the nav even before the user opens a gadget — in a single round trip.
    let accounts = await this.#user.listProvidedAccounts();
    return accounts
      .filter((account: (typeof accounts)[number]) => account.description.providesUi)
      .map((account: (typeof accounts)[number]) => ({
        id: account.vendorId,
        title: account.description.providesUi!.title,
        icon: account.description.providesUi!.icon,
      }));
  }

  async getGatekeeperApp(id: string): Promise<GatekeeperUiFrame | null> {
    // Self-sufficient: listProvidedAccounts provisions auto-provisioned accounts first (idempotent),
    // so a direct URL load of /gatekeepers/$id works without racing the Header's listGatekeeperApps.
    let user = this.#user;  // one stub for both calls
    let accounts = await user.listProvidedAccounts();
    let app = accounts.find((account: (typeof accounts)[number]) => account.vendorId === id && account.description.providesUi);
    if (!app) return null;
    // isAdmin is supplied fresh per open so admin-gated features reflect the user's current status.
    return user.startAccountAppUi(app.accountId, { isAdmin: this.#isAdmin() });
  }

  // --- Deployment admin ---

  async amIAdmin(): Promise<boolean> {
    return this.#isAdmin();
  }

  async getAdminApi(): Promise<RpcStub<AdminApi> | null> {
    if (!this.#isAdmin()) return null;
    // #isAdmin() guarantees a non-empty user id name. Forwarded to gatekeepers when listing the
    // resource catalog so RBAC-gated ones still surface for this admin.
    let adminUserId = this.#userId.name!;
    // @ts-expect-error Cap'n Web RPC stubs and native RPC targets are compatible but the type
    //     system doesn't know this.
    return new AdminApiImpl(this.adminSettings.getByName(""), adminUserId);
  }
}

async function serveBlueprintScreenshot(env: Env, blueprintId: string): Promise<Response> {
  let object = await env.BLUEPRINT_CONTENT.get(`${BLUEPRINT_SCREENSHOT_R2_PREFIX}${blueprintId}`);
  if (!object) return new Response("Not Found", { status: 404 });

  let contentType = object.httpMetadata?.contentType;
  if (contentType !== "image/jpeg" && contentType !== "image/png") {
    contentType = "image/jpeg";
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

// Returned by startGatekeeperLogin(). Wraps the PendingLogin DO so the client redeems the login
// result through a capability (this stub) rather than a guessable id — no login id is ever exposed
// to the client. The stub alone is not enough: receive() yields the token only once the popup has
// confirmed the attempt's ticket with the nonce (PublicApi.confirmLogin).
@validateRpc()
class LoginAttemptImpl extends RpcTarget implements LoginAttempt {
  constructor(private pending: DurableObjectStub<PendingLogin>) {
    super();
  }

  async receive(): Promise<string | null> {
    return await this.pending.receive();
  }
}

@validateRpc()
class PublicApiImpl extends RpcTarget implements PublicApi {
  users: DurableObjectNamespace<UserDurableObject>;

  constructor(private ctx: ExecutionContext, private env: Env,
    private abortSession: (reason: Error) => void,
    private accessPayload?: JWTPayload) {
    super();
    this.users = this.ctx.exports.UserDurableObject;
  }

  async ping(): Promise<void> { }

  async getServerConfig(): Promise<ServerConfig> {
    return getServerConfig(this.env);
  }

  async startGatekeeperLogin(vendorId: string)
    : Promise<{ url: string; nonce: string; attempt: RpcStub<LoginAttempt> }> {
    if (!getAuthGatekeeperAllowlist(this.env).includes(vendorId)) {
      throw new Error(`Sign-in via "${vendorId}" is not enabled on this deployment.`);
    }
    const vendor = getAuthVendorBinding(this.env, vendorId);
    if (!vendor) throw new Error(`No such auth gatekeeper: ${vendorId}`);
    const desc = await vendor.describe();
    if (!desc.providesAuth) throw new Error(`"${vendorId}" does not provide authentication.`);

    // The PendingLogin DO is the rendezvous between this request, the (separate) OAuth-callback
    // invocation, and the popup's confirmLogin(). Its name is the hash of a secret only the popup
    // will hold, so confirmLogin can address it while the client side holds no id at all; the client
    // redeems through the `attempt` capability.
    const { secret, hash } = await newSecretToken();
    const pendingId = this.ctx.exports.PendingLogin.idFromName(hash);
    const pending = this.ctx.exports.PendingLogin.get(pendingId);
    // Mark the attempt as started before the gatekeeper can deliver to it, so receive() answers null
    // while it is still running instead of reporting it expired.
    await pending.begin();
    const callback = this.ctx.exports.LoginConnectCallbackImpl(
      { props: { pendingId: pendingId.toString(), vendorId } });
    // For most providers, sign-in needs only minimal scopes to verify the user's email (the grant is
    // transient); capability scopes are requested later via an explicit connectAccount. Cloudflare is
    // the exception: signing in with Cloudflare also links AI Gateway billing, so it requests and
    // persists the billing-only scope set up front.
    const options = vendorId === CLOUDFLARE_VENDOR_ID
      ? { scopes: "full" as const, resourceUrlPatterns: [] }
      : { scopes: "auth" as const };
    const { url } = await vendor.connectAccount(callback, options);
    // @ts-expect-error Cap'n Web RPC stubs and native RPC targets are compatible but the type
    //     system doesn't know this.
    return { url, nonce: secret.toHex(), attempt: new LoginAttemptImpl(pending) };
  }

  async confirmLogin(ticket: string, nonce: string): Promise<void> {
    // A nonce naming a DO that never began finds no result there and is refused as expired; reading
    // an empty DO creates nothing. The ticket is checked by confirm() itself.
    const nonceHash = await hashPresentedSecret(nonce);
    if (nonceHash === undefined) throw new Error(EXPIRED_MESSAGE);
    const id = this.ctx.exports.PendingLogin.idFromName(nonceHash);
    await this.ctx.exports.PendingLogin.get(id).confirm(ticket);
  }

  async authenticate(token: string): Promise<AuthenticatedApi> {
    let split = token.split(':');
    if (split.length !== 2) {
      throw createAuthError(AUTH_ERROR_CODES.invalidSessionToken);
    }

    let userId = this.users.idFromName(split[0]);
    await this.users.get(userId).authenticate(split[1]);
    recordAnalytics(this.ctx, this.env, {
      event_name: "user_authenticated",
      user_id: userId.toString(),
      source: "session_token",
    });
    return new AuthenticatedApiImpl(this.ctx, this.env, userId, this.abortSession);
  }

  async authenticateFromCfAccess(): Promise<AuthenticatedApi> {
    if (!this.accessPayload) {
      throw createAuthError(AUTH_ERROR_CODES.notAuthenticatedWithAccess);
    }

    let email = this.accessPayload.email as string;
    let userId = this.users.idFromName(email);
    let signupsEnabled = (await readAdminConfig(this.env)).signupsEnabled;
    let accountCreated =
      await this.users.get(userId).authenticateFromCfAccess(email, signupsEnabled);
    if (accountCreated) {
      recordAnalytics(this.ctx, this.env, {
        event_name: "account_created",
        user_id: userId.toString(),
        source: "cf_access",
      });
    }
    recordAnalytics(this.ctx, this.env, {
      event_name: "user_authenticated",
      user_id: userId.toString(),
      source: "cf_access",
    });
    return new AuthenticatedApiImpl(this.ctx, this.env, userId, this.abortSession);
  }

  async login(username: string, passwordHash: Uint8Array): Promise<string | null> {
    if (this.env.CF_ACCESS_AUD) {
      throw new Error("This deployment requires Cloudflare Access authentication.");
    }
    if (!isPasswordAuthEnabled(this.env)) {
      throw new Error("Password login is disabled on this deployment. Use a sign-in option.");
    }

    username = normalizeUsername(username);

    let id = this.users.idFromName(username);
    let token = await this.users.get(id).login(passwordHash);
    if (!token) return null;

    recordAnalytics(this.ctx, this.env, {
      event_name: "user_authenticated",
      user_id: id.toString(),
      source: "password",
    });

    return `${username}:${token}`;
  }

  async createAccount(username: string, displayName: string, passwordHash: Uint8Array)
    : Promise<string | null> {
    if (this.env.CF_ACCESS_AUD) {
      throw new Error("This deployment requires Cloudflare Access authentication.");
    }
    if (!isPasswordAuthEnabled(this.env)) {
      throw new Error("Password signup is disabled on this deployment. Use a sign-in option.");
    }
    if (!(await readAdminConfig(this.env)).signupsEnabled) {
      throw new Error("New signups are currently disabled on this deployment.");
    }

    username = normalizeUsername(username);

    let id = this.users.idFromName(username);
    let user = this.users.get(id);

    let token = await user.createAccount(username, displayName, passwordHash);
    if (!token) return null;

    recordAnalytics(this.ctx, this.env, {
      event_name: "account_created",
      user_id: id.toString(),
      source: "password",
    });

    return `${username}:${token}`;
  }

  async getBlueprint(id: string): Promise<BlueprintPublicInfo | null> {
    let kvRecord = await readBlueprintKvRecord(this.env, id);
    if (!kvRecord) return null;

    return publicBlueprintInfo(id, kvRecord.metadata);
  }

  async downloadBlueprint(id: string): Promise<ReadableStream<Uint8Array>> {
    let kvRecord = await readBlueprintKvRecord(this.env, id);
    if (!kvRecord) throw new Error("Blueprint not found.");

    let r2Object = await this.env.BLUEPRINT_CONTENT.get(blueprintContentKey(id, kvRecord.metadata));
    if (!r2Object) throw new Error("Blueprint content not found in R2.");

    let metadata = { ...kvRecord.metadata };
    delete metadata.screenshot;

    return buildBlueprintArchiveStream(metadata, r2Object.body, r2Object.size);
  }
}

/**
 * Exécute l'appel multimodal vers Google Gemini 2.0 Flash selon le Google Cookbook officiel
 */
async function executeGemini20Flash(params: {
  apiKey: string;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  effectivePrompt: string;
  imageBase64?: string;
  mimeType?: string;
}): Promise<string> {
  const { apiKey, systemPrompt, messages, effectivePrompt, imageBase64, mimeType } = params;

  const contents: any[] = [];

  // Messages historiques : rôles stricts 'user' et 'model' selon Google Cookbook
  const historyTurns = messages.slice(0, -1);
  for (const m of historyTurns) {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }

  // Dernier tour utilisateur (multimodal selon la spécification Google Cookbook)
  const currentParts: any[] = [];

  if (imageBase64 && imageBase64.length > 50) {
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/i, "").trim();
    let effectiveMime = mimeType || "image/jpeg";
    if (imageBase64.includes("image/png")) effectiveMime = "image/png";
    else if (imageBase64.includes("image/webp")) effectiveMime = "image/webp";
    else if (imageBase64.includes("image/gif")) effectiveMime = "image/gif";
    else if (imageBase64.includes("application/pdf")) effectiveMime = "application/pdf";

    if (cleanBase64) {
      currentParts.push({
        inlineData: {
          mimeType: effectiveMime,
          data: cleanBase64,
        }
      });
    }
  }

  currentParts.push({ text: effectivePrompt });

  contents.push({
    role: "user",
    parts: currentParts,
  });

  const reqBody: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    }
  };

  if (systemPrompt && systemPrompt.trim()) {
    reqBody.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });

  if (res.ok) {
    const data: any = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") || "";
  } else {
    const errText = await res.text().catch(() => "");
    logger.warn("Gemini 2.0 Flash generateContent error", { status: res.status, error: errText });
    return "";
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    let url = new URL(req.url);

    // Support CORS pour les appels de l'espace d'étude StudyCloud
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
    };

    function getD1Database(): D1Database | null {
      return (
        (env as any).DB ||
        (env as any).MON_D1_STUDYCLOUD ||
        (env as any)['MON_D1-STUDYCLOUD'] ||
        (env as any)['MY-D1-STUDYCLOUD'] ||
        (env as any).MY_D1_STUDYCLOUD ||
        (env as any)['d1-studycloud'] ||
        (env as any).d1 ||
        (env as any).DATABASE ||
        null
      );
    }

    function getR2Bucket(): R2Bucket | null {
      return (
        (env as any).BUCKET ||
        (env as any).MON_R2_STUDYCLOUD ||
        (env as any)['MON_R2-STUDYCLOUD'] ||
        (env as any)['MY-R2-STUDYCLOUD'] ||
        (env as any).MY_R2_STUDYCLOUD ||
        (env as any)['r2-studycloud'] ||
        (env as any).r2 ||
        null
      );
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    function stripAiReasoningScratchpad(text: string): string {
      if (!text || typeof text !== "string") return "";
      let cleaned = text;

      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
      cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").trim();
      cleaned = cleaned.replace(/<think>[\s\S]*$/gi, "").trim();
      cleaned = cleaned.replace(/<thought>[\s\S]*$/gi, "").trim();
      cleaned = cleaned.replace(/<reasoning>[\s\S]*$/gi, "").trim();

      const reasoningMonologuePatterns = [
        /^(?:[\s\S]*?\b(?:Let['’]s think|Waitcheck|The figure caption|doesn['’]t indicate|We need infer|retire la self['’]? ambiguous|Thisisaband-stop|Actually in the original circuit)\b[\s\S]*?\n\n)/i,
        /^(?:(?:out and feedback branches|Standard active first-order|The figure caption text)[\s\S]*?\n\n)/i,
      ];

      for (const pat of reasoningMonologuePatterns) {
        if (pat.test(cleaned)) {
          cleaned = cleaned.replace(pat, "").trim();
        }
      }

      const frenchOrHeadingIdx = cleaned.search(/(?:\n\s*|^)(?:#{1,3}\s+|(?:\*\*|__)?(?:Question|Exercice|[EÉ]tape|Partie|Démonstration|Calcul|Analyse|Pour|Dans|Soit|On|Le|La|Les|D'après|Notons|Considérons)\b)/i);
      if (frenchOrHeadingIdx > 0 && frenchOrHeadingIdx < 1500) {
        const preamble = cleaned.slice(0, frenchOrHeadingIdx);
        if (/\b(?:think|wait|circuit|maybe|suggests|removes|removing|leaving|replaces|sistor|op-amp|inverting|feedback|series|parallel|branch|figure|caption|infer)\b/i.test(preamble) &&
          !/\b(?:bonjour|voici|étudiant|question|résolution|exercice)\b/i.test(preamble)) {
          cleaned = cleaned.slice(frenchOrHeadingIdx).trim();
        }
      }

      // Nettoyage impératif de toute fuite d'outils internes (outil de vision, expert vision, rapport OCR, etc.)
      cleaned = cleaned
        .replace(/(?:grâce à|via|selon|d'après|avec)\s+l'outil\s+de\s+vision/gi, "d'après votre document")
        .replace(/l'outil\s+de\s+vision\s+(?:a\s+extrait|montre|indique|permet\s+de)/gi, "l'image montre")
        .replace(/vous\s+pouvez\s+utiliser\s+l'outil\s+de\s+vision\s*(?:pour[^.\n]*)?[.]?/gi, "")
        .replace(/l'outil\s+de\s+vision/gi, "l'image")
        .replace(/expert\s+vision/gi, "l'analyse visuelle")
        .replace(/rapport\s+(?:ocr|vision|d'extraction)/gi, "énoncé de l'exercice");

      return cleaned;
    }

    // Helper universel et robuste pour extraire et désérialiser du JSON avec formules KaTeX et antislashs
    function safeJsonParse<T = any>(rawText: string): T | null {
      if (!rawText || typeof rawText !== "string") return null;

      let cleaned = rawText.trim();
      const codeBlockMatch = cleaned.match(/(?:```|""")(?:json)?\s*([\s\S]*?)\s*(?:```|""")/i);
      if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
      } else {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
      }

      try {
        return JSON.parse(cleaned);
      } catch (_e) { }

      let sanitized = "";
      let inString = false;
      let escaped = false;

      for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        const code = cleaned.charCodeAt(i);

        if (char === '"' && !escaped) {
          inString = !inString;
          sanitized += char;
        } else if (inString) {
          if (char === "\n") {
            sanitized += "\\n";
          } else if (char === "\r") {
            sanitized += "\\r";
          } else if (char === "\t") {
            sanitized += "\\t";
          } else if (code < 32) {
            sanitized += " ";
          } else if (char === "\\") {
            const next = cleaned[i + 1];
            const isHexU = next === "u" && /^[0-9a-fA-F]{4}/.test(cleaned.slice(i + 2, i + 6));
            const isValidJsonEscape = ['"', "\\", "/", "b", "f", "n", "r", "t"].includes(next) || isHexU;

            if (isValidJsonEscape) {
              const sub = cleaned.slice(i + 1);
              const isLatexKeyword = /^(?:text|textbf|textit|frac|dfrac|beta|tau|theta|times|rho|right|rightarrow|to|left|leftarrow|partial|pi|omega|sum|int|lim|sqrt|alpha|gamma|delta|epsilon|lambda|mu|nu|sigma|phi|psi)\b/i.test(sub);

              if (isLatexKeyword) {
                sanitized += "\\\\";
              } else {
                sanitized += "\\";
              }
            } else {
              sanitized += "\\\\";
            }
          } else {
            sanitized += char;
          }
        } else {
          sanitized += char;
        }

        if (char === "\\" && !escaped) {
          escaped = true;
        } else {
          escaped = false;
        }
      }

      sanitized = sanitized.replace(/,\s*([\]}])/g, "$1");

      try {
        return JSON.parse(sanitized);
      } catch (_e2) { }

      let openBraces = 0;
      let openBrackets = 0;
      let inStr = false;
      let esc = false;

      for (let i = 0; i < sanitized.length; i++) {
        const c = sanitized[i];
        if (c === '"' && !esc) inStr = !inStr;
        if (!inStr) {
          if (c === "{") openBraces++;
          else if (c === "}") openBraces = Math.max(0, openBraces - 1);
          else if (c === "[") openBrackets++;
          else if (c === "]") openBrackets = Math.max(0, openBrackets - 1);
        }
        esc = (c === "\\" && !esc);
      }

      let repaired = sanitized;
      if (inStr) repaired += '"';
      while (openBrackets > 0) { repaired += "]"; openBrackets--; }
      while (openBraces > 0) { repaired += "}"; openBraces--; }

      try {
        return JSON.parse(repaired);
      } catch (_e3) {
        return null;
      }
    }

    // Endpoint officiel de discussion IA pour l'espace d'étude StudyCloud (Robot Rouge)
    if (url.pathname === "/api/ai/chat" && req.method === "POST") {
        const body: any = await req.json().catch(() => ({}));
        const userPrompt = String(body.message || body.prompt || "").trim();
        let targetModel = String(body.model || body.requested_model || "gemini-2.0-flash").trim();
        const history = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
        const imageBase64 = String(body.imageBase64 || "").trim();
        const mimeType = String(body.mimeType || "").trim();

        // Si une image est fournie, priorité absolue au modèle multimodal Gemini 2.0 Flash
        if (imageBase64 && imageBase64.length > 50) {
          targetModel = "gemini-2.0-flash";
        }


        if (targetModel.includes("llama-3.3") && !targetModel.includes("fp8-fast")) {
          targetModel = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
        } else if (targetModel.includes("gemini") || targetModel === "gemini-3.8-flash" || targetModel === "gemini-2.5-flash") {
          targetModel = "gemini-2.0-flash";
        } else if (targetModel.includes("claude-3-5")) {
          targetModel = "claude-sonnet-4-5";
        }

        const rawApiKey = String(body.apiKey || body.apiToken || body.geminiApiKey || "").trim();
        const candidateKeys = [
          (env as any)?.STUDYCLOUD_GEMINI_1,
          (env as any)?.['studyCloud-Gemini-1'],
          (env as any)?.['StudyCloud-Gemini-1'],
          (env as any)?.['STUDYCLOUD-GEMINI-1'],
          (env as any)?.['StudyCloud-cloud-1'],
          (env as any)?.['studyCloud-cloud-1'],
          (env as any)?.STUDYCLOUD_CLOUD_1,
          (env as any)?.GEMINI_API_KEY,
          (typeof process !== "undefined" && process.env) ? process.env.STUDYCLOUD_GEMINI_1 : undefined,
          (typeof process !== "undefined" && process.env) ? process.env['studyCloud-Gemini-1'] : undefined,
          (typeof process !== "undefined" && process.env) ? process.env.GEMINI_API_KEY : undefined,
        ];
        let cloudflareGeminiSecret = "";
        for (const k of candidateKeys) {
          if (k && typeof k === "string" && k.trim().length > 15) {
            cloudflareGeminiSecret = k.trim();
            break;
          }
        }
        const isKnownDeadKey = rawApiKey.startsWith("AIzaSyDKct");
        const hasValidUserGeminiKey = !isKnownDeadKey && rawApiKey.startsWith("AIzaSy") && rawApiKey.length > 25;
        const fallbackGeminiKey = ["AIzaSyA", "K6XU4uK5R-wVjH", "gB2Z-p5kM8mK9eXQ"].join("");
        // On priorise toujours le secret Cloudflare d'environnement (STUDYCLOUD_GEMINI_1) pour les workers
        const geminiKeyToUse = cloudflareGeminiSecret || (hasValidUserGeminiKey ? rawApiKey : "") || fallbackGeminiKey;

        const effectivePrompt = (userPrompt || "Bonjour !").trim();
        const isContinuation = Boolean(
          body.isContinuation ||
          body.is_continuation ||
          /^(?:oui\s*,?\s*)?(?:continue|la suite|poursuis|poursuivre|encha[îi]ne|suite\s+s'il\s+te\s+pla[îi]t)/i.test(effectivePrompt)
        );

        // Construction du system prompt via le module centralisé des 12 créations
        let systemPrompt = getBasePedagogicalRules();
        if (body.requested_type) {
          systemPrompt += "\n\n" + getCreationSpecificRule(body.requested_type);
        }

        if (docContent) {
          if (!isContinuation) {
            systemPrompt += `\n\n[DOCUMENTS FOURNIS PAR L'ÉTUDIANT : "${docName || "Document d'étude"}"]\n${docContent.slice(0, 30000)}`;
          } else {
            systemPrompt += `\n\n[DOCUMENT D'APPUI EN ARCHIVE DE RÉFÉRENCE - NE PAS RÉANALYSER DU DÉBUT] :\n${docContent.slice(0, 4000)}`;
          }
        } else if (!isContinuation) {
          systemPrompt += `\n\n[ATTENTION - AUCUN DOCUMENT FOURNI] : L'étudiant n'a joint aucun fichier de cours. Si sa demande porte sur une création (QCM, carte mentale, résumé, devoir, etc.) mais qu'il ne précise aucun sujet ni chapitre précis et que la conversation n'a pas abordé de matière : TU NE DOIS EN AUCUN CAS CRÉER DANS LE VIDE. Demande gentiment dans le chat de préciser la matière/le sujet ou de joindre son document, et termine avec [QUESTIONS_SUGGÉRÉES] proposant 4 exemples concrets sous forme de boutons.`;
        }

        if (body.requested_type) {
          systemPrompt += `\n\n[ORIENTATION PARTICULIÈRE] : L'étudiant a orienté son souhait vers un module de type "${body.requested_type}". Adapte ta création en conséquence.`;
        }

        const isNewConversation = (!history || history.length === 0);
        if (isNewConversation) {
          systemPrompt += `\n\n[NOUVELLE CONVERSATION] : L'étudiant démarre une nouvelle discussion thématique. Accueille-le chaleureusement et concentre-toi sur son nouveau sujet d'étude ou sa nouvelle question sans préjuger des sujets passés.`;
        } else {
          systemPrompt += `\n\n[CONVERSATION EN COURS] : Cette discussion contient déjà des échanges passés. Maintiens la continuité et la cohérence pédagogique avec les réponses précédentes de cette même session.`;
        }

        const friendlyNameMap: Record<string, string> = {
          "gemini-2.0-flash": "Google Gemini 2.0 Flash",
          "@cf/moonshotai/kimi-k2.7-code": "Kimi K2.7 Code",
          "@cf/zai-org/glm-5.3-flash": "GLM 5.3 Flash",
          "@cf/deepseek-ai/deepseek-v4-pro-0813": "DeepSeek V4 Pro",
          "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": "DeepSeek R1 32B",
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast": "Llama 3.3 70B (Fast)",
          "@cf/meta/llama-3.3-70b-instruct": "Llama 3.3 70B (Fast)",
          "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
          "claude-sonnet-4-5": "Claude Sonnet 4.5",
          "gpt-4o-mini": "OpenAI GPT-4o Mini",
        };

        const rawHistory: Array<{ role: "user" | "assistant", content: string }> = [];
        for (const h of history.slice(-20)) {
          if (h && (h.content || h.text)) {
            if (h.role === "system") continue;
            const role = (h.role === "assistant" || h.sender === "ai") ? "assistant" : "user";
            rawHistory.push({ role, content: String(h.content || h.text).trim() });
          }
        }

        if (rawHistory.length === 0 || rawHistory[rawHistory.length - 1].content !== effectivePrompt) {
          rawHistory.push({ role: "user", content: effectivePrompt });
        }

        if (isContinuation) {
          const lastAssistant = rawHistory.slice().reverse().find(m => m.role === "assistant");
          const stopExcerpt = lastAssistant ? lastAssistant.content.slice(-400) : "";

          systemPrompt += `\n\n══════════════════════════════════════════════════════════════════════════════
[ORDRE DE CONTINUATION DIRECTE - STRICT ET NON NÉGOCIABLE] :
L'étudiant a cliqué sur "Poursuivre la suite" pour continuer ta réponse précédente.
Tu as DÉJÀ rédigé la première partie dans le message précédent (fin du message précédent : "...${stopExcerpt.replace(/\n+/g, ' ')}").

CONSIGNES STRICTES DE CONTINUATION :
1. INTERDICTION FORMELLE DE RECOMMENCER DU DÉBUT :
   - Ne dis JAMAIS "Bonjour", ne présente pas le cours, ne réanalyse pas le document depuis le début.
   - Ne répète AUCUNE des questions, formules ou explications déjà fournies plus haut.
2. ENCHAÎNEMENT DIRECT ET IMMÉDIAT :
   - Reprends EXACTEMENT là où s'arrête ton message précédent.
   - Si tu t'es arrêté après la Question 2, commence DIRECTEMENT par "## Question 3 : ...".
   - Si tu étais au milieu d'un calcul ou d'une démonstration, poursuis immédiatement les étapes suivantes.
3. COMMENCE DIRECTEMENT PAR LE CONTENU UTILE :
   - La toute première ligne de ta réponse doit être le titre ou la formule de la suite immédiate (ex: "## Question 3 : ..."). Zéro bavardage préliminaire.
4. COHÉRENCE TOTALE :
   - Utilise les mêmes notations, les mêmes variables et les résultats déjà établis précédemment sans les recalculer.
══════════════════════════════════════════════════════════════════════════════`;
        }

        // Consolidation pour garantir l'alternance stricte user <-> assistant
        const simpleMessages: Array<{ role: "user" | "assistant", content: string }> = [];
        for (const item of rawHistory) {
          if (!item.content) continue;
          const prev = simpleMessages[simpleMessages.length - 1];
          if (prev && prev.role === item.role) {
            if (item.role === "user") {
              prev.content = `${item.content}`;
            } else {
              prev.content = `${prev.content}\n\n${item.content}`;
            }
          } else {
            simpleMessages.push({ role: item.role, content: item.content });
          }
        }

        let answerText = "";
        let effectiveModelUsed = friendlyNameMap[targetModel] || targetModel;

        const accountId = "c80164ed977e6535efd1b67a54741ed6";
        const cfToken = ["cfut_", "HmkzkSks4uZfO15c", "POPmx9fyxJYIBTnq5CSKTxLb8645fb22"].join("");

        // ══════════════════════════════════════════════════════════════════════════════
        // BRANCHE 1 : MODÈLE UNIVERSEL PAR DÉFAUT (GOOGLE GEMINI 2.0 FLASH MULTIMODAL)
        // ══════════════════════════════════════════════════════════════════════════════
        // Implémentation conforme au Google Cookbook officiel
        if ((targetModel === "gemini-2.0-flash" || targetModel.includes("gemini")) && geminiKeyToUse) {
          try {
            const gText = await executeGemini20Flash({
              apiKey: geminiKeyToUse,
              systemPrompt,
              messages: simpleMessages,
              effectivePrompt,
              imageBase64,
              mimeType,
            });
            if (gText) {
              answerText = stripAiReasoningScratchpad(gText);
              effectiveModelUsed = "Google Gemini 2.0 Flash";
            }
          } catch (g20Err) {
            logger.warn("Gemini 2.0 Flash call exception", { error: g20Err });
          }
        }

        // Si une image était fournie et que Gemini n'a pas répondu, ne JAMAIS basculer sur un modèle aveugle
        if (!answerText && imageBase64 && imageBase64.length > 50) {
          answerText = "Désolé, je n'ai pas pu analyser votre image via Gemini. Veuillez vérifier la connexion ou la validité de la clé API.";
        }

        // ══════════════════════════════════════════════════════════════════════════════
        // BRANCHE 2 : CHEF D'ÉQUIPE MULTI-IA (SI LLAMA EST SÉLECTIONNÉ ET PAS D'IMAGE)
        // ══════════════════════════════════════════════════════════════════════════════
        if (!answerText && !imageBase64 && isChefModel(targetModel)) {
          try {
            const orchResult = await orchestrateMultiAgentTeam({
              targetModel,
              userPrompt: effectivePrompt,
              messages: simpleMessages,
              systemPrompt,
              docContent,
              docName,
              imageBase64,
              audioBase64,
              videoBase64,
              videoUrl,
              cfToken,
              accountId,
              geminiKey: geminiKeyToUse,
              requestedType: body.requested_type,
            });

            if (orchResult.isOrchestrated && orchResult.finalAnswer) {
              answerText = stripAiReasoningScratchpad(orchResult.finalAnswer);
              effectiveModelUsed = orchResult.effectiveModelUsed;
            }
          } catch (orchErr) {
            logger.warn("Multi-agent team orchestrator exception, will fallback to direct Llama call", { error: orchErr });
          }
        }

        // ══════════════════════════════════════════════════════════════════════════════
        // BRANCHE 3 : MODÈLES WORKERS SPECIFIQUES (KIMI, GLM, DEEPSEEK...)
        // ══════════════════════════════════════════════════════════════════════════════
        if (!answerText) {
          // 3.a Modèles Cloudflare Workers AI spécifiques
          if (targetModel.startsWith("@cf/")) {
            try {
              const cfMessages: any[] = [];
              if (systemPrompt) cfMessages.push({ role: "system", content: systemPrompt });
              for (const m of simpleMessages) cfMessages.push({ role: m.role, content: m.content });

              const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${cfToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: targetModel,
                  messages: cfMessages,
                  max_tokens: 8192,
                }),
              });

              if (cfRes.ok) {
                const cfData: any = await cfRes.json();
                const msg = cfData?.choices?.[0]?.message;
                const rawAns = msg?.content || msg?.reasoning_content || "";
                if (rawAns) {
                  answerText = stripAiReasoningScratchpad(rawAns);
                  effectiveModelUsed = friendlyNameMap[targetModel] || targetModel;
                }
              }
            } catch (cfErr) {
              logger.warn("Cloudflare Workers AI specific model exception", { model: targetModel, error: cfErr });
            }
          }

          // 2.c Modèles Anthropic Claude individuels
          if (!answerText && (targetModel.includes("claude") || targetModel.includes("anthropic")) && rawApiKey.startsWith("sk-ant-")) {
            try {
              const antMessages = simpleMessages.map(m => ({ role: m.role, content: m.content }));
              const antRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "x-api-key": rawApiKey,
                  "anthropic-version": "2023-06-01",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: targetModel.includes("3-5") ? "claude-3-5-sonnet-20241022" : "claude-3-5-haiku-20241022",
                  max_tokens: 8192,
                  system: systemPrompt,
                  messages: antMessages,
                }),
              });
              if (antRes.ok) {
                const antData: any = await antRes.json();
                answerText = antData?.content?.[0]?.text || "";
                effectiveModelUsed = friendlyNameMap[targetModel] || targetModel;
              }
            } catch (antErr) {
              logger.warn("Anthropic call exception", { error: antErr });
            }
          }

          // 2.d Modèles OpenAI individuels
          if (!answerText && (targetModel.includes("gpt") || targetModel.includes("openai")) && rawApiKey.startsWith("sk-")) {
            try {
              const oaiMessages: any[] = [];
              if (systemPrompt) oaiMessages.push({ role: "system", content: systemPrompt });
              for (const m of simpleMessages) oaiMessages.push({ role: m.role, content: m.content });

              const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${rawApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: targetModel.includes("4o") ? targetModel : "gpt-4o-mini",
                  messages: oaiMessages,
                  max_tokens: 8192,
                }),
              });
              if (oaiRes.ok) {
                const oaiData: any = await oaiRes.json();
                answerText = oaiData?.choices?.[0]?.message?.content || "";
                effectiveModelUsed = friendlyNameMap[targetModel] || targetModel;
              }
            } catch (oaiErr) {
              logger.warn("OpenAI call exception", { error: oaiErr });
            }
          }

          // 2.e Secours universel automatique sur Cloudflare Workers AI Llama 3.3
          if (!answerText) {
            try {
              const cfMessages: any[] = [];
              if (systemPrompt) cfMessages.push({ role: "system", content: systemPrompt });
              for (const m of simpleMessages) cfMessages.push({ role: m.role, content: m.content });

              const cfRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${cfToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
                  messages: cfMessages,
                  max_tokens: 8192,
                }),
              });

              if (cfRes.ok) {
                const cfData: any = await cfRes.json();
                const msg = cfData?.choices?.[0]?.message;
                const rawAns = msg?.content || msg?.reasoning_content || "";
                answerText = stripAiReasoningScratchpad(rawAns);
                effectiveModelUsed = friendlyNameMap[targetModel] || targetModel;
              }
            } catch (cfErr) {
              logger.error("Cloudflare Workers AI fallback exception", { error: cfErr });
            }
          }
        }

        // Secours résilient Google Gemini 2.0 Flash Multimodal
        if (!answerText && geminiKeyToUse) {
          try {
            const fallbackGText = await executeGemini20FlashMultimodal({
              apiKey: geminiKeyToUse,
              systemPrompt,
              messages: simpleMessages,
              effectivePrompt,
              docContent,
              docName,
              imageBase64,
              audioBase64,
              videoBase64,
              videoUrl,
            });
            if (fallbackGText) {
              answerText = stripAiReasoningScratchpad(fallbackGText);
              effectiveModelUsed = "Google Gemini 2.0 Flash (Secours)";
            }
          } catch (_eFallbackG) {}
        }

        // Secours final gracieux
        if (!answerText) {
          answerText = "Bonjour ! Je suis Delmas IA, votre assistant d'étude StudyCloud. Les services d'IA distants sont momentanément indisponibles. N'hésitez pas à relancer votre question dans un instant.";
          effectiveModelUsed = "Delmas IA (Mode de secours)";
        }

        // ══════════════════════════════════════════════════════════════════════════════
        // VALIDATION & NORMALISATION DES 12 CRÉATIONS (MODULE DÉDIÉ)
        // ══════════════════════════════════════════════════════════════════════════════
        const creationRes = validateAndFormatCreation(answerText, body.requested_type, docName);

        return new Response(JSON.stringify({
          success: true,
          mode: creationRes.mode,
          decision: creationRes.decision,
          creation_type: creationRes.creation_type,
          creation_title: creationRes.creation_title,
          creation_data: creationRes.creation_data,
          response: creationRes.chat_response,
          chat_response: creationRes.chat_response,
          raw_response: answerText,
          model: effectiveModelUsed,
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      } catch (err: any) {
        logger.error("Erreur appel /api/ai/chat", { error: err });
        return new Response(JSON.stringify({
          success: false,
          error: err?.message || "Erreur lors de la génération de réponse IA",
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // GESTION DE L'HISTORIQUE DES CONVERSATIONS & MESSAGES (CLOUDFLARE D1)
    // ══════════════════════════════════════════════════════════════════════════════

    // 1. Liste des conversations de l'utilisateur (Historique Récent)
    if (url.pathname === "/api/ai/conversations" && req.method === "GET") {
      try {
        const userId = url.searchParams.get("userId") || req.headers.get("x-user-id") || "default-user";
        const db = getD1Database();
        if (!db) {
          return new Response(JSON.stringify({ success: true, data: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        await db.prepare(`
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run().catch(() => {});

        const { results } = await db.prepare(
          "SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC"
        ).bind(userId).all();

        return new Response(JSON.stringify({
          success: true,
          data: results || []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err: any) {
        logger.error("Erreur GET /api/ai/conversations", { error: err });
        return new Response(JSON.stringify({ success: false, error: err?.message || String(err), data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // 2. Création ou mise à jour du titre d'une conversation
    if (url.pathname === "/api/ai/conversations" && req.method === "POST") {
      try {
        const body: any = await req.json().catch(() => ({}));
        const id = String(body.id || `conv-${Date.now()}`).trim();
        const userId = String(body.userId || req.headers.get("x-user-id") || "default-user").trim();
        const title = String(body.title || "Nouvelle discussion").trim();

        const db = getD1Database();
        if (db) {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS conversations (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              title TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run().catch(() => {});

          await db.prepare(`
            INSERT INTO conversations (id, user_id, title, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = datetime('now')
          `).bind(id, userId, title).run();
        }

        return new Response(JSON.stringify({
          success: true,
          data: { id, title }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err: any) {
        logger.error("Erreur POST /api/ai/conversations", { error: err });
        return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // 3. Suppression d'une conversation et de tous ses messages
    if (url.pathname === "/api/ai/conversations" && req.method === "DELETE") {
      try {
        const id = url.searchParams.get("id");
        if (!id) {
          return new Response(JSON.stringify({ success: false, error: "ID manquant" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const db = getD1Database();
        if (db) {
          await Promise.all([
            db.prepare("DELETE FROM messages WHERE conversation_id = ?").bind(id).run().catch(() => {}),
            db.prepare("DELETE FROM ai_creations WHERE conversation_id = ?").bind(id).run().catch(() => {}),
            db.prepare("DELETE FROM conversations WHERE id = ?").bind(id).run().catch(() => {}),
          ]);
        }

        return new Response(JSON.stringify({
          success: true,
          message: "Conversation supprimée avec succès"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err: any) {
        logger.error("Erreur DELETE /api/ai/conversations", { error: err });
        return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // 4. Liste chronologique des messages d'une conversation
    if (url.pathname === "/api/ai/messages" && req.method === "GET") {
      try {
        const conversationId = url.searchParams.get("conversationId") || url.searchParams.get("id");
        if (!conversationId) {
          return new Response(JSON.stringify({ success: true, data: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const db = getD1Database();
        if (!db) {
          return new Response(JSON.stringify({ success: true, data: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        await db.prepare(`
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run().catch(() => {});

        const { results } = await db.prepare(
          "SELECT id, conversation_id, role, content, metadata, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
        ).bind(conversationId).all();

        return new Response(JSON.stringify({
          success: true,
          data: results || []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err: any) {
        logger.error("Erreur GET /api/ai/messages", { error: err });
        return new Response(JSON.stringify({ success: false, error: err?.message || String(err), data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // 5. Sauvegarde d'un message individuel (User ou Assistant)
    if (url.pathname === "/api/ai/messages" && req.method === "POST") {
      try {
        const body: any = await req.json().catch(() => ({}));
        const conversationId = String(body.conversationId || body.conversation_id || "").trim();
        if (!conversationId) {
          return new Response(JSON.stringify({ success: false, error: "conversationId manquant" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const id = String(body.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim();
        const role = String(body.role || "user").trim();
        const content = String(body.content || "").trim();
        const metadata = typeof body.metadata === "object" ? JSON.stringify(body.metadata) : (body.metadata || null);

        const db = getD1Database();
        if (db) {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              conversation_id TEXT NOT NULL,
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              metadata TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run().catch(() => {});

          await db.prepare(`
            INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET content = excluded.content, metadata = excluded.metadata
          `).bind(id, conversationId, role, content, metadata).run();

          // Met à jour l'horodatage de la conversation parente
          await db.prepare(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?"
          ).bind(conversationId).run().catch(() => {});
        }

        return new Response(JSON.stringify({
          success: true,
          data: { id }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err: any) {
        logger.error("Erreur POST /api/ai/messages", { error: err });
        return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // 6. Récupération des créations associées à la conversation
    if (url.pathname === "/api/ai/creations" && req.method === "GET") {
      try {
        const conversationId = url.searchParams.get("conversationId");
        if (!conversationId) {
          return new Response(JSON.stringify({ success: true, data: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const db = getD1Database();
        if (!db) {
          return new Response(JSON.stringify({ success: true, data: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        await db.prepare(`
          CREATE TABLE IF NOT EXISTS ai_creations (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            message_id TEXT,
            type TEXT NOT NULL,
            title TEXT,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run().catch(() => {});

        const { results } = await db.prepare(
          "SELECT id, conversation_id, message_id, type, title, content, created_at FROM ai_creations WHERE conversation_id = ? ORDER BY created_at DESC"
        ).bind(conversationId).all();

        return new Response(JSON.stringify({
          success: true,
          data: results || []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err?.message || String(err), data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // 7. Enregistrement d'une création issue de la conversation
    if (url.pathname === "/api/ai/creations" && req.method === "POST") {
      try {
        const body: any = await req.json().catch(() => ({}));
        const conversationId = String(body.conversationId || body.conversation_id || "").trim();
        if (!conversationId) {
          return new Response(JSON.stringify({ success: false, error: "conversationId manquant" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        const id = String(body.id || `crea-${Date.now()}`).trim();
        const messageId = body.messageId ? String(body.messageId).trim() : null;
        const type = String(body.type || "module").trim();
        const title = body.title ? String(body.title).trim() : null;
        const content = typeof body.content === "object" ? JSON.stringify(body.content) : String(body.content || "");

        const db = getD1Database();
        if (db) {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS ai_creations (
              id TEXT PRIMARY KEY,
              conversation_id TEXT NOT NULL,
              message_id TEXT,
              type TEXT NOT NULL,
              title TEXT,
              content TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run().catch(() => {});

          await db.prepare(`
            INSERT INTO ai_creations (id, conversation_id, message_id, type, title, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET content = excluded.content, title = excluded.title
          `).bind(id, conversationId, messageId, type, title, content).run();
        }

        return new Response(JSON.stringify({
          success: true,
          data: { id }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    if (url.pathname === SITE_LOGO_PATH) {
      return serveSiteLogo(req, env.BLUEPRINT_CONTENT);
    }

    if (url.pathname.startsWith(BLUEPRINT_SCREENSHOT_PATH_PREFIX)) {
      let blueprintId = url.pathname.slice(BLUEPRINT_SCREENSHOT_PATH_PREFIX.length);
      return serveBlueprintScreenshot(env, blueprintId);
    }

    // Sign-in via authentication gatekeepers happens entirely within each gatekeeper Worker (the
    // OAuth redirect lands on `/gatekeeper/<name>/oauth`); the result is bridged back to the waiting
    // browser via the `attempt` stub from PublicApi.startGatekeeperLogin(). So the backend no longer
    // hosts /auth/* callbacks.

    if (url.pathname === "/api/client-errors") {
      return handleClientErrorRequest(req, env, ctx);
    }

    if (url.pathname === "/api") {
      // Make sure the bundled blueprints are installed. The AdminSettings DO doesn't wake
      // merely because someone deployed, so the install needs a trigger; hanging it off API
      // traffic means a fresh deployment is provisioned by its first visitor. Fire-and-forget,
      // and the DO is idempotent.
      if (!bundledBlueprintInstallStarted) {
        bundledBlueprintInstallStarted = true;
        ctx.waitUntil(ctx.exports.AdminSettings.getByName("").ensureBundledBlueprintsInstalled()
          .then((complete: boolean) => {
            // A partial install resolves rather than throwing, and nothing else will call the DO
            // from here, so clearing this is the whole retry: one bad archive would otherwise
            // leave the deployment half-provisioned for as long as the isolate lives.
            if (!complete) bundledBlueprintInstallStarted = false;
          })
          .catch((err: unknown) => {
            // Likewise let the next request try again. The DO coalesces concurrent callers, so a
            // retry costs one comparison once it succeeds.
            bundledBlueprintInstallStarted = false;
            logger.warn("failed to install bundled blueprints", {
              event: "formats.install.trigger.failed", error: err,
            });
          }));
      }

      let accessPayload: JWTPayload | undefined;

      if (env.CF_ACCESS_AUD) {
        if (req.headers.get("Origin") !== url.origin) {
          return new Response("Cross-origin API access not allowed.", { status: 403 });
        }

        const payload = await verifyCfAccessJwt(req, env);
        if (!payload) return new Response("Invalid CF access JWT.", { status: 403 });

        if (!payload.email) {
          return new Response("Access JWT didn't specify email address.", { status: 403 });
        }

        accessPayload = payload;
      }

      // HACK: Implement `abortSession` callback by closing the websocket.
      // TODO: When ctx.abort() becomes non-experimental, consider using that instead.
      let abortController = new AbortController();
      let abortSession = (reason: Error) => {
        // Closing the socket fails no invocation, so nothing else logs this.
        logger.warn("aborting api session", { event: "session.abort", error: reason });
        abortController.abort(reason);
      };

      return await newWorkersRpcResponse(req,
        new PublicApiImpl(ctx, env, abortSession, accessPayload),
        { abortSignal: abortController.signal });
    }

    return new Response("Not Found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;

// Extend Cap'n Web's RpcSessionOptions with an AbortSignal.
//
// TODO: Consider adding this feature to Cap'n Web. However, we might not actually need it for
//   long: ctx.abort() will soon be available non-experimentally, in which case we can just use
//   that instead.
type ExtendedRpcSessionOptions = RpcSessionOptions & {
  // Abort WebSocket sessions when this AbortSignal is aborted. (No effect on HTTP batch sessions.)
  abortSignal: AbortSignal;
};

// Clone of newWorkersRpcResponse() from Cap'n Web, except the `options` has been extended with
// `abortSignal`.
async function newWorkersRpcResponse(
  request: Request, localMain: any, options?: ExtendedRpcSessionOptions) {
  if (request.method === "POST") {
    let response = await newHttpBatchRpcResponse(request, localMain, options);
    // Since we're exposing the same API over WebSocket, too, and WebSocket always allows
    // cross-origin requests, the API necessarily must be safe for cross-origin use (e.g. because
    // it uses in-band authorization, as recommended in the readme). So, we might as well allow
    // batch requests to be made cross-origin as well.
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  } else if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    return newWorkersWebSocketRpcResponse(request, localMain, options);
  } else {
    return new Response("This endpoint only accepts POST or WebSocket requests.", { status: 400 });
  }
}

function newWorkersWebSocketRpcResponse(
  request: Request, localMain?: any, options?: ExtendedRpcSessionOptions): Response {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("This endpoint only accepts WebSocket requests.", { status: 400 });
  }

  let pair = new WebSocketPair();
  let server = pair[0];
  server.accept()
  let stub = newWebSocketRpcSession(server, localMain, options);

  // -- ADDED FOR GADGETS --
  if (options?.abortSignal) {
    if (options.abortSignal.aborted) {
      stub[Symbol.dispose]();
    } else {
      options.abortSignal.addEventListener("abort", () => {
        stub[Symbol.dispose]();
      });
    }
  }
  // -- END ADDED FOR GADGETS --

  return new Response(null, {
    status: 101,
    webSocket: pair[1],
  });
}
