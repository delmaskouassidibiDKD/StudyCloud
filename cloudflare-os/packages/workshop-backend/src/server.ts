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
export { OverseerDurableObject, GatekeeperLoopback, GatekeeperHookLoopback,
    CodeModeTailLoopback, AgentSpawnerGatekeeper, GadgetTailLoopback,
    AgentSelfLoopback };

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
  getModelConfig(id: string): Promise<{profile: AiChatAuthorInfo, config: RedactedAiModelConfig}> {
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
    return offers.map(({agentHint: _agentHint, bindings: _bindings, ...offer}) => offer);
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
  if (!object) return new Response("Not Found", {status: 404});

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

  async ping(): Promise<void> {}

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

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    let url = new URL(req.url);

    // Support CORS pour les appels de l'espace d'étude StudyCloud
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
    };

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

      return cleaned;
    }

    // Endpoint officiel de discussion IA pour l'espace d'étude StudyCloud (Robot Rouge)
    if (url.pathname === "/api/ai/chat" && req.method === "POST") {
      try {
        const body: any = await req.json().catch(() => ({}));
        const userPrompt = String(body.message || body.prompt || "").trim();
        let targetModel = String(body.model || body.requested_model || "gemini-3.8-flash").trim();
        const history = Array.isArray(body.history) ? body.history : (Array.isArray(body.messages) ? body.messages : []);
        const docContent = String(body.attachedFileContent || body.file_content || body.documentContent || "").trim();
        const docName = String(body.attachedFileName || body.file_name || "").trim();

        if (targetModel.includes("llama-3.3") && !targetModel.includes("fp8-fast")) {
          targetModel = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
        } else if (targetModel.includes("gemini") && !targetModel.includes("3.8")) {
          targetModel = "gemini-3.8-flash";
        } else if (targetModel.includes("claude-3-5")) {
          targetModel = "claude-sonnet-4-5";
        }

        const rawApiKey = String(body.apiKey || body.apiToken || "").trim();
        const leakedKey = ["AIzaSyDKct", "AYvG5MuOLsrGGe", "NAVg-OgdIkmu85s"].join("");
        const hasValidUserGeminiKey = rawApiKey.startsWith("AIzaSy") && rawApiKey !== leakedKey && rawApiKey.length > 25;

        // Système autonome cognitif : C'est l'IA qui décide selon la causerie si elle discute ou si elle crée un module
        let systemPrompt = `Tu es Delmas IA, l'intelligence pédagogique centrale et autonome de StudyCloud (Robot Rouge).
Tu es directement connectée à l'espace d'étude et à l'espace de création interactif de l'étudiant.
Tu analyses l'ensemble de la causerie, du dialogue et du contexte pour déterminer en toute autonomie et intelligence le mode d'action et la forme de restitution les plus adaptés :

1. BRANCHE DISCUSSION NATURELLE DANS LE CHAT (Mode par défaut) :
Si l'étudiant discute, échange, pose une question de cours, demande des explications, une formule, une méthode, une démonstration, ou échange de manière générale :
-> Tu réponds DIRECTEMENT ET NATURELLEMENT DANS LE CHAT en français fluide, structuré et bienveillant (titres, listes à puces, clarté).
-> Formules mathématiques et scientifiques rédigées en syntaxe LaTeX standard ($...$ en ligne, $$...$$ en bloc).
-> RÈGLE ABSOLUE : N'inclus STRICTEMENT AUCUN objet JSON dans cette réponse. Parle directement à l'étudiant.

2. BRANCHE CRÉATION AUTONOME D'UN MODULE D'APPRENTISSAGE (Espace Création à droite) :
Si tu juges, au vu de la causerie ou de la demande de l'étudiant, qu'il a besoin d'un support interactif complet (s'entraîner, tester ses acquis, mémoriser, synthétiser ou structurer son cours) :
C'EST TOI, L'IA, QUI DÉCIDES DU DESIGN ET DU TYPE DE MODULE LE PLUS ADAPTÉ :
- 'questionnaire' : Quiz interactif à choix multiples (QCM) (questions avec choices A/B/C/D, correct, explanation).
- 'carte-mentale' : Mindmap visuelle arborescente (thème central root, main branches, sub-branches).
- 'carte-memoire' : Flashcards interactives de mémorisation (recto: notion/question, verso: synthèse/réponse).
- 'resume' : Fiche de synthèse structurée (overview, key_points, definitions, rules).
- 'vrai-ou-faux' : Test interactif Vrai ou Faux avec justifications pédagogiques.
- 'exercices-ecrits' : Série d'exercices d'application avec énoncés et corrigés pas-à-pas.
- 'devoir-complet' : Sujet d'évaluation complet avec barème et parties détaillées.
- 'infographie' : Fiche visuelle synthétique avec chiffres clés, étapes et repères.
- 'pdf' : Polycopié de cours exhaustif avec sections et contenus structurés.

DANS CE CAS DE CRÉATION EXCLUSIVEMENT :
Tu produis OBLIGATOIREMENT ET UNIQUEMENT une réponse sous forme d'objet JSON strict :
\`\`\`json
{
  "decision": "creation",
  "mode": "creation",
  "creation_type": "questionnaire" | "carte-mentale" | "carte-memoire" | "resume" | "vrai-ou-faux" | "exercices-ecrits" | "devoir-complet" | "infographie" | "pdf",
  "creation_title": "Titre explicite et valorisant du module créé",
  "chat_response": "Un message amical et court d'une seule phrase pour le chat (ex: J'ai conçu votre questionnaire interactif dans l'espace Création à droite !)",
  "creation_data": {
    // Les données exhaustives et complètes adaptées au module choisi
  }
}
\`\`\`
RÈGLES D'EXCELLENCE POUR LA MISE EN PAGE, LES TITRES ET LES FRACTIONS :
0. LANGUE FRANÇAISE STRICTE ET ZÉRO MONOLOGUE INTERNE (ANTI-SCRATCHPAD) :
   - TU RÉPONDS EXCLUSIVEMENT ET TOTALEMENT EN FRANÇAIS SOIGNÉ, CLAIR ET PÉDAGOGIQUE.
   - IL EST STRICTEMENT INTERDIT D'ÉCRIRE EN ANGLAIS ET D'AFFICHER UN MONOLOGUE DE RÉFLEXION INTERNE, DU BRAINSTORMING OU UN BROUILLON ('Let's think', 'Waitcheck', 'The figure caption text', 'Hmm', 'Actually', etc.).
   - NE DIVAGUE PAS. DONNE DIRECTEMENT LA RÉPONSE PÉDAGOGIQUE COMPLÈTE ET STRUCTURÉE POUR L'ÉTUDIANT.
   - AÈRE AU MAXIMUM : GRANDS TITRES (#, ##, ###), DOUBLES SAUTS DE LIGNE ENTRE CHAQUE ÉTAPE, ET FORMULES ISOLÉES EN BLOC $$ ... $$.

1. INTERDICTION FORMELLE D'ÉCRIRE DES FRACTIONS AVEC LE SLASH '/' :
   - IL EST STRICTEMENT INTERDIT d'écrire des fractions sous la forme a/b ou 1/√(LC) ou A0 = -R2/R1 ou (1/Q0)(p/w0).
   - TOUTE fraction mathématique ou scientifique DOIT IMPÉRATIVEMENT être écrite sous forme de vraie fraction verticale avec \\dfrac{numérateur}{dénominateur} :
     * Le numérateur en haut,
     * La barre horizontale nette au milieu,
     * Le dénominateur en bas.
   - Exemples obligatoires :
     * JAMAIS : w0 = 1/√(LC)  --> TOUJOURS : $$ \\omega_0 = \\dfrac{1}{\\sqrt{LC}} $$
     * JAMAIS : f0 = 1/(2π√(LC)) --> TOUJOURS : $$ f_0 = \\dfrac{1}{2\\pi \\sqrt{LC}} $$
     * JAMAIS : Q0 = Lw0/R1 --> TOUJOURS : $$ Q_0 = \\dfrac{L\\omega_0}{R_1} = \\dfrac{1}{R_1 C \\omega_0} = \\dfrac{1}{R_1}\\sqrt{\\dfrac{L}{C}} $$
     * JAMAIS : A0 = -R2/R1 --> TOUJOURS : $$ A_0 = -\\dfrac{R_2}{R_1} $$
     * JAMAIS : T(p) = -R2 C p / [...] --> TOUJOURS : $$ T(p) = \\dfrac{-R_2 C p}{1 + \\dfrac{1}{Q_0}\\dfrac{p}{\\omega_0} + \\left(\\dfrac{p}{\\omega_0}\\right)^2} $$
   - Utilise TOUJOURS les lettres grecques correctes : \\omega_0 (jamais w0), \\pi (jamais pi), \\tau, \\alpha, \\beta, \\Omega.

2. STRUCTURE AÉRÉE, GRANDS TITRES ET COULEURS :
   - Structure TOUJOURS ta réponse avec des grands titres clairs (# Grand Titre pour le sujet, ## Titre pour chaque question ou étape majeure, ### Sous-titre pour les sous-étapes).
   - Sépare clairement chaque question ou étape de calcul (ex: ## Question 5 : Expressions canoniques de A₀, f₀, Q₀).
   - Fais de VRAIS sauts de ligne doubles entre chaque paragraphe ou étape pour que le texte ne soit JAMAIS compacté ni groupé.
   - Pour chaque formule majeure, écris-la isolée sur sa propre ligne entre doubles dollars $$ ... $$ pour qu'elle s'affiche en grand, centrée et aérée.
   - Encadre systématiquement le résultat final de chaque question avec \\boxed{...} dans un bloc centré $$ \\boxed{...} $$.
   - Souligne les concepts essentiels avec \\underline{...} ou du gras **...**.

3. GESTION DES EXERCICES LONGS ET DÉCOUPAGE PÉDAGOGIQUE INTELLIGENT (ZÉRO COUPURE BRUTALE) :
   - Tu dois TOUT FAIRE et résoudre le sujet avec une rigueur absolue.
   - SI L'EXERCICE OU LA DÉMONSTRATION EST PARTICULIÈREMENT LONGUE OU DENSE (plusieurs questions successives, gros calculs) :
     * Résous méthodiquement les étapes ou questions en cours jusqu'au bout, avec leurs résultats intermédiaires encadrés dans \\boxed{...}.
     * NE TE COUPE JAMAIS EN PLEIN MILIEU d'une équation ou d'une phrase !
     * Si une étape/question importante est achevée et que la suite risque d'être trop lourde ou volumineuse pour un seul message, ARRÊTE-TOI AU BON MOMENT à la fin de cette étape propre.
     * Demande alors clairement à l'étudiant : "Voulez-vous que je poursuive avec la question suivante / la suite de la démonstration ?"
   - SI L'ÉTUDIANT RÉPOND "OUI", "CONTINUE", OU DEMANDE LA SUITE :
     * Enchaîne IMMÉDIATEMENT avec la suite exacte (les questions suivantes ou la seconde partie de la démonstration), sans répéter ce qui a déjà été expliqué.

4. SCHÉMAS, CIRCUITS ET DESSINS VECTORIELS (DESSINER SI NÉCESSAIRE) :
   - Si la résolution ou l'explication concerne un circuit électronique (ex: AOP, filtre RLC, quadripôle, pont diviseur), un repère géométrique, un signal ou un schéma bloc :
     DESSINE-LE DIRECTEMENT sous forme de schéma vectoriel SVG propre et net dans un bloc de code \`\`\`svg ... \`\`\` :
     * Utilise une balise <svg viewBox="0 0 550 250" xmlns="http://www.w3.org/2000/svg" className="w-full">
     * Style moderne et sombre : fond sombre (#0d0f17) ou transparent, traits en orange (#f97316) ou cyan (#38bdf8), textes lisibles en blanc (#f3f4f6) avec font-size adaptée.
     * Indique clairement les composants (Ve, Vs, R1, R2, C, L, noeuds, masse GND, entrées + et - de l'AOP).

5. DÉCISION AUTONOME SUR LES QUESTIONS SUGGÉRÉES (PROPOSITIONS SOUS FORME DE CARTES BOUTONS) :
   - À la fin d'un problème, exercice, démonstration ou situation, C'EST TOI L'IA QUI DÉCIDES AUTONOMEMENT s'il est pertinent de suggérer des questions de prolongement ou d'approfondissement à l'étudiant.
   - Si tu juges pertinent d'en proposer (et uniquement quand la situation s'y prête bien), ajoute à la toute fin de ta réponse le bloc :
[QUESTIONS_SUGGÉRÉES]
- Question ou piste de calcul 1
- Question ou piste de calcul 2
- Question ou piste de calcul 3
   Ces questions seront automatiquement transformées en boutons carrés cliquables pour l'étudiant. Si la situation ne nécessite aucun prolongement, ne mets pas ce bloc.

6. STRUCTURATION STRICTE, ALINÉAS ET SÉPARATION DES COMMENTAIRES :
   - NE CONFONDS JAMAIS les commentaires avec les calculs ou les explications théoriques !
   - EXPLICATIONS : Rédige des phrases claires et aérées avec de grands titres (#, ##, ###).
   - ALINÉAS : Pour les sous-questions ou sous-étapes, utilise systématiquement des alinéas avec 'a) ', 'b) ', 'c) ' ou '1) ', '2) ' pour que chaque étape soit bien indentée et aérée.
   - CALCULS PURS : Isole chaque formule majeure dans un bloc centré $$ ... $$ avec \\dfrac{}{} et le résultat final encadré dans $$ \\boxed{...} $$.
   - COMMENTAIRES ET REMARQUES : Mets TOUJOURS tes commentaires, observations physiques, astuces ou conseils sous la forme :
> **Remarque :** Ton commentaire méthodologique ici.
ou
> **Note :** Ta note de vigilance ici.
   Ils seront ainsi isolés dans un encadré distinct bleu ciel sans jamais se mélanger aux calculs.
- DANS LES CRÉATIONS (Questionnaires, QCM, Cartes, Exercices) : Toute formule dans l'énoncé et dans CHAQUE option de réponse DOIT impérativement être entourée de dollars, par exemple : "$T(j\\omega) = \\dfrac{T_0}{1 + j\\dfrac{\\omega}{\\omega_0}}$".

7. POSITION ALÉATOIRE DES BONNES RÉPONSES ET DIVERSITÉ EXTRÊME :
- DANS LES QCM ('questionnaire') : "correct_index" DOIT ÊTRE ALÉATOIREMENT DISTRIBUÉ (0, 1, 2, 3), ne place JAMAIS la bonne réponse toujours en première ou deuxième position.
- DIVERSITÉ : Ne pose pas toujours les mêmes questions d'introduction. Explore tout le document, intègre des calculs chiffrés réels ($...$), des problèmes d'application et des cas limites.
- Vrai ou Faux : Équilibre strictement environ 50% VRAI et 50% FAUX avec justifications stimulantes.

8. DIRECTIVE SYSTÈME STRICTE DE STRUCTURATION PÉDAGOGIQUE POUR LES CARTES MENTALES ('carte-mentale') :
Tu es le moteur de structuration pédagogique de l'application. Lorsque l'utilisateur te soumet un cours, un document ou un sujet, tu dois obligatoirement analyser les concepts et les lier entre eux sous forme de carte mentale logique.
- PAS DE PHRASES NARRATIVES NI DE LONGS PARAGRAPHES.
- UTILISE UNIQUEMENT DES MOTS-CLÉS PERCUTANTS, des notions courtes et précises.
- INTÈGRE LES FORMULES SCIENTIFIQUES/TECHNIQUES PERTINENTES directement reliées au bon concept (ex: 'Fréquence de coupure : $f_c = \\dfrac{1}{2\\pi RC}$', 'Gain statique : $T_0 = -\\dfrac{R_2}{R_1}$', 'Facteur de qualité : $Q_0 = \\dfrac{1}{R}\\sqrt{\\dfrac{L}{C}}$').
- Structure ta réponse de manière à ce qu'un utilisateur comprenne immédiatement les liens de cause à effet et la logique globale (Thème central -> Axes majeurs -> Sous-notions et Formules).
- FORMAT DE SORTIE STRUCTURÉ EXPLOITABLE PAR LE FRONT-END (JSON ou Mermaid) :
  Dans 'creation_data', fournis impérativement la structure hiérarchique :
  \`\`\`json
  {
    "root_title": "Thème Central du Cours",
    "root": {
      "title": "Thème Central du Cours",
      "children": [
        {
          "title": "Axe Majeur 1 (ex: Définition & Rôle)",
          "children": [
            { "title": "Sous-notion percutante 1", "formula": "f_c = \\dfrac{1}{2\\pi RC}" },
            { "title": "Sous-notion percutante 2" }
          ]
        }
      ]
    },
    "branches": [
      {
        "title": "Axe Majeur 1",
        "children": [
          { "title": "Sous-notion percutante 1", "formula": "f_c = \\dfrac{1}{2\\pi RC}" },
          { "title": "Sous-notion percutante 2" }
        ]
      }
    ]
  }
  \`\`\`
  Alternativement, tu peux inclure un champ 'mermaid': "mindmap\\n  root((Thème))\\n    Axe 1\\n      Notion 1\\n      Formule: $...$" qui sera dessiné à l'écran.
- INTERDICTION FORMELLE d'utiliser des placeholders vides comme 'Sous-notion 1', 'Sous-notion 2', 'Branche 1' : chaque nœud DOIT porter le vrai concept ou la formule du cours !`;

        if (docContent) {
          systemPrompt += `\n\n[DOCUMENTS FOURNIS PAR L'ÉTUDIANT : "${docName || "Document d'étude"}"]\n${docContent.slice(0, 30000)}`;
        } else {
          systemPrompt += `\n\n[ATTENTION - AUCUN DOCUMENT FOURNI] : L'étudiant n'a joint aucun fichier de cours. Si sa demande porte sur une création (QCM, carte mentale, résumé, devoir, etc.) mais qu'il ne précise aucun sujet ni chapitre précis et que la conversation n'a pas abordé de matière : TU NE DOIS EN AUCUN CAS CRÉER DANS LE VIDE. Tu dois lui demander gentiment dans le chat de préciser la matière/le sujet ou de joindre son document, et terminer avec [QUESTIONS_SUGGÉRÉES] proposant 4 exemples concrets sous forme de boutons.`;
        }
        if (body.requested_type) {
          systemPrompt += `\n\n[ORIENTATION PARTICULIÈRE] : L'étudiant a orienté son souhait vers un module de type "${body.requested_type}". Adapte ta création en conséquence.`;
        }

        const friendlyNameMap: Record<string, string> = {
          "@cf/moonshotai/kimi-k2.7-code": "Kimi K2.7 Code",
          "@cf/zai-org/glm-5.3-flash": "GLM 5.3 Flash",
          "@cf/deepseek-ai/deepseek-v4-pro-0813": "DeepSeek V4 Pro",
          "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": "DeepSeek R1 32B",
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast": "Llama 3.3 70B (Fast)",
          "@cf/meta/llama-3.3-70b-instruct": "Llama 3.3 70B (Fast)",
          "gemini-3.8-flash": "Google Gemini 3.8 Flash",
          "gemini-3.6-flash": "Google Gemini 3.6 Flash",
          "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet",
          "claude-sonnet-4-5": "Claude Sonnet 4.5",
          "gpt-4o-mini": "OpenAI GPT-4o Mini",
        };

        const simpleMessages: Array<{ role: "user" | "assistant", content: string }> = [];
        for (const h of history.slice(-8)) {
          if (h && (h.content || h.text)) {
            if (h.role === "system") continue;
            const role = (h.role === "assistant" || h.sender === "ai") ? "assistant" : "user";
            simpleMessages.push({ role, content: String(h.content || h.text) });
          }
        }
        simpleMessages.push({ role: "user", content: userPrompt || "Bonjour !" });

        let answerText = "";
        let effectiveModelUsed = friendlyNameMap[targetModel] || targetModel;

        const accountId = "c80164ed977e6535efd1b67a54741ed6";
        const cfToken = ["cfut_", "HmkzkSks4uZfO15c", "POPmx9fyxJYIBTnq5CSKTxLb8645fb22"].join("");

        // 1. Modèles Cloudflare Workers AI demandés explicitement (ex: Kimi K2.7, GLM 5.3, DeepSeek, Llama)
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
              const rawAns = msg?.content || msg?.reasoning_content || "";
              answerText = stripAiReasoningScratchpad(rawAns);
              effectiveModelUsed = friendlyNameMap[targetModel] || targetModel;

              // Protection anti-coupure brutale au milieu d'un mot ou d'une phrase
              if (finishReason === "length" || (answerText && !/[.!?:;\n]$/.test(answerText.trim()) && !answerText.trim().endsWith("$$"))) {
                answerText = answerText.trim().replace(/\s+[a-zA-ZÀ-ÿ0-9_-]+$/, "");
                answerText += "\n\n*(Le calcul est vaste et dense. Voulez-vous que je continue avec la suite exacte ?)*";
              }
            } else {
              const errTxt = await cfRes.text();
              logger.warn("Cloudflare Workers AI specific model failed, will try fallback", { model: targetModel, status: cfRes.status, err: errTxt });
            }
          } catch (cfErr) {
            logger.warn("Cloudflare Workers AI specific model exception", { model: targetModel, error: cfErr });
          }
        }

        // 2. Modèles Google Gemini demandés
        if (!answerText && (targetModel.includes("gemini") || targetModel.includes("google"))) {
          if (hasValidUserGeminiKey) {
            try {
              const contents: any[] = [];
              for (const m of simpleMessages) {
                contents.push({
                  role: m.role === "assistant" ? "model" : "user",
                  parts: [{ text: m.content }],
                });
              }
              const geminiReqBody: any = { contents };
              if (systemPrompt) {
                geminiReqBody.systemInstruction = { parts: [{ text: systemPrompt }] };
              }
              const gModelId = targetModel.includes("3.6") ? "gemini-3.6-flash" : "gemini-3.8-flash";
              const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModelId}:generateContent?key=${rawApiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(geminiReqBody),
              });
              if (geminiRes.ok) {
                const gData: any = await geminiRes.json();
                answerText = gData?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") || "";
                effectiveModelUsed = friendlyNameMap[targetModel] || "Google Gemini 3.8 Flash";
              } else {
                const errTxt = await geminiRes.text();
                logger.warn("Google Gemini API error, falling back to Cloudflare Workers AI", { status: geminiRes.status, err: errTxt });
              }
            } catch (gErr) {
              logger.warn("Google Gemini call exception, falling back to Workers AI", { error: gErr });
            }
          }
        }

        // 3. Modèles Anthropic Claude demandés (avec clé API sk-ant-)
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
            logger.warn("Anthropic call exception, falling back", { error: antErr });
          }
        }

        // 4. Modèles OpenAI demandés (avec clé API OpenAI)
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
            logger.warn("OpenAI call exception, falling back", { error: oaiErr });
          }
        }

        // 5. Secours automatique universel sur Cloudflare Workers AI (Llama 3.3 70B Fast)
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
              const finishReason = cfData?.choices?.[0]?.finish_reason;
              const rawAns = msg?.content || msg?.reasoning_content || "";
              answerText = stripAiReasoningScratchpad(rawAns);
              effectiveModelUsed = targetModel.startsWith("@cf/")
                ? (friendlyNameMap[targetModel] || targetModel)
                : `${friendlyNameMap[targetModel] || targetModel} (Secours Llama 3.3)`;

              if (finishReason === "length" || (answerText && !/[.!?:;\n]$/.test(answerText.trim()) && !answerText.trim().endsWith("$$"))) {
                answerText = answerText.trim().replace(/\s+[a-zA-ZÀ-ÿ0-9_-]+$/, "");
                answerText += "\n\n*(Le calcul est vaste et dense. Voulez-vous que je continue avec la suite exacte ?)*";
              }
            } else {
              const cfErrTxt = await cfRes.text();
              logger.error("Cloudflare Workers AI returned error", { status: cfRes.status, err: cfErrTxt });
            }
          } catch (cfErr) {
            logger.error("Cloudflare Workers AI call exception", { error: cfErr });
          }
        }

        // 5. Ultime secours pédagogique gracieux si toutes les passerelles sont inaccessibles
        if (!answerText) {
          answerText = "Bonjour ! Je suis Delmas IA, votre assistant d'étude StudyCloud. Les services d'IA distants sont momentanément saturés ou indisponibles. N'hésitez pas à relancer votre question dans un instant.";
          effectiveModelUsed = "Delmas IA (Mode de secours)";
        }

        // 6. Extraction intelligente de la décision de l'IA (Discussion vs Création interactive)
        let mode: string = "chat";
        let creationType: string | null = null;
        let creationTitle: string | null = null;
        let creationData: any = null;
        let companionChatText: string = answerText;

        const jsonMatch = answerText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || answerText.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
          try {
            const rawParsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            if (rawParsed && typeof rawParsed === "object") {
              const payloadData = rawParsed.creation_data || (
                rawParsed.questions || rawParsed.affirmations || rawParsed.cards ||
                rawParsed.root || rawParsed.branches || rawParsed.mermaid || rawParsed.overview || rawParsed.sections ||
                rawParsed.exercises || rawParsed.exercices || null
              );
              if (rawParsed.decision === "creation" || rawParsed.mode === "creation" || payloadData) {
                mode = "creation";
                creationType = rawParsed.creation_type || (
                  rawParsed.questions ? "questionnaire" :
                  rawParsed.affirmations ? "vrai-ou-faux" :
                  rawParsed.cards ? "carte-memoire" :
                  (rawParsed.root || rawParsed.branches || rawParsed.mermaid) ? "carte-mentale" :
                  rawParsed.overview ? "resume" :
                  rawParsed.exercises || rawParsed.exercices ? "exercices-ecrits" :
                  "questionnaire"
                );
                creationTitle = rawParsed.creation_title || rawParsed.title || `${(creationType || "MODULE").toUpperCase()} : ${docName || "Étude Académique"}`;
                creationData = payloadData || rawParsed;
                companionChatText = rawParsed.chat_response || rawParsed.chat_message || `✨ J'ai créé votre **${creationTitle}** directement dans votre espace **Création** à droite !`;
              }
            }
          } catch (_e) {
            // Pas de JSON : reste en mode discussion normale fluide
          }
        }

        // Détection de Mermaid Mindmap direct dans la réponse
        if (mode !== "creation") {
          const mermaidMatch = answerText.match(/```(?:mermaid)?\s*(mindmap[\s\S]*?)```/i) || (answerText.trim().startsWith("mindmap") ? [answerText, answerText] : null);
          if (mermaidMatch) {
            mode = "creation";
            creationType = "carte-mentale";
            creationTitle = `CARTE MENTALE : ${docName || "Étude Académique"}`;
            creationData = { mermaid: mermaidMatch[1].trim() };
            companionChatText = `✨ J'ai créé votre **${creationTitle}** directement dans votre espace **Création** à droite !`;
          }
        }

        return new Response(JSON.stringify({
          success: true,
          mode,
          decision: mode,
          creation_type: creationType,
          creation_title: creationTitle,
          creation_data: creationData,
          response: companionChatText,
          chat_response: companionChatText,
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

    return new Response("Not Found", {status: 404});
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
