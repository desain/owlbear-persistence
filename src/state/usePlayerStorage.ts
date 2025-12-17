import { type ImageContent, type Item, type Theme } from "@owlbear-rodeo/sdk";
import { enableMapSet, type WritableDraft } from "immer";
import {
    DEFAULT_GRID,
    DEFAULT_THEME,
    getAllAttachments,
    toItemMap,
    type ExtractNonFunctions,
    type ItemMap,
    type Role,
} from "owlbear-utils";
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { applyPersisted } from "../action/applyPersisted";
import { processAttachments } from "../action/processAttachments";
import { LOCAL_STORAGE_STORE_NAME } from "../constants";
import { isToken, tokenKey, type Token } from "../Token";
import {
    dateLte,
    persistedTokenGetName,
    persistedTokenKey,
    persistedTokenSetName,
    persistedTokenUpdate,
    type PersistedToken,
    type PersistenceType,
} from "./PersistedToken";

enableMapSet();

interface LocalStorage {
    readonly contextMenuEnabled: boolean;
    readonly tokens: PersistedToken[];
    readonly setContextMenuEnabled: (
        this: void,
        contextMenuEnabled: boolean,
    ) => void;
    /**
     * Persist all given tokens. If a token is already persisted uniquely, it will be
     * skipped. If a token is already persisted as a template, and the given persistence
     * type is 'TEMPLATE', the template will be updated.
     * @param tokens Array of token, type to persist as, and attachments for the token
     *               (undefined attachments means no attachments.
     */
    readonly persist: (
        this: void,
        tokens: { token: Token; type: PersistenceType; attachments?: Item[] }[],
    ) => void;
    readonly setType: (
        this: void,
        key: ImageContent["url"],
        type: PersistenceType,
    ) => void;
    readonly setTokenName: (
        this: void,
        key: ImageContent["url"],
        name: string,
    ) => void;
    readonly setTokenDisabledProperties: (
        this: void,
        key: ImageContent["url"],
        disabledProperties: PersistedToken["disabledProperties"],
    ) => void;
    readonly removeToken: (this: void, key: ImageContent["url"]) => void;
    readonly importTokens: (this: void, tokens: PersistedToken[]) => void;
}

function partializeLocalStorage({
    contextMenuEnabled,
    tokens,
}: LocalStorage): ExtractNonFunctions<LocalStorage> {
    return { contextMenuEnabled, tokens };
}

function getUrlUsage(tokens: Token[]): Map<ImageContent["url"], number> {
    const map = new Map<ImageContent["url"], number>();
    for (const token of tokens) {
        map.set(token.image.url, (map.get(token.image.url) ?? 0) + 1);
    }
    return map;
}

interface OwlbearStore {
    readonly sceneReady: boolean;
    readonly role: Role;
    readonly theme: Theme;
    // readonly playerId: string;
    // readonly grid: GridParsed;
    readonly items: ItemMap;
    /**
     * URL to usage count.
     */
    readonly keyUsage: Map<ImageContent["url"], number>;
    // readonly roomMetadata: RoomMetadata;
    readonly setSceneReady: (this: void, sceneReady: boolean) => void;
    readonly setRole: (this: void, role: Role) => void;
    // readonly setPlayerId: (this: void, playerId: string) => void;
    // readonly setGrid: (this: void, grid: GridParams) => Promise<void>;
    // readonly setSelection: (this: void, selection: string[] | undefined) => Promise<void>;
    readonly handleItemsChange: (this: void, items: Item[]) => void;
    // readonly handleRoomMetadataChange: (this: void, metadata: Metadata) => void;
    readonly handleThemeChange: (this: void, theme: Theme) => void;

    /*
    Notes on mirroring metadata:

    https://discord.com/channels/795808973743194152/1082460044731371591/1110879213348737057
    Player metadata isn't saved between refreshes

    Below is some of the technical differences between types of metadata.

    Networking:
    The metadata for a scene or scene item uses a CRDT so it is network resilient.
    The metadata for a player uses a simple CRDT but can only be updated by one person at a time so collisions aren't a concern there.
    Room metadata doesn't use any network resiliency and is last writer wins. Which is why it is generally meant for small values with very low frequency updates.

    Size:
    Metadata for a scene uses the users storage quota.
    Each individual update to the scene and player metadata is limited by the max update size (64kb).
    The room metadata has a max size of 16kB shared across all extensions.

    Other Differences:
    Updates to the scene metadata are added to the undo stack of the user. This means a Ctrl+Z will undo changes made.
    Player metadata is per connection. This means that refreshing the page will reset the metadata}

    Tool metadata is stored in localStorage so all the limitations of that apply.
    This also means that there is no networking in tool metadata and it will be erased if the user clears their cache.
    */
}

/**
 * @returns Index of token with given key, -1 if not found; persisted token if extant, undefined otherwise
 */
export function getPersistedToken<T extends LocalStorage>(
    state: WritableDraft<T>,
    key: ImageContent["url"],
): {
    persistedTokenIdx: number;
    persistedToken?: WritableDraft<T["tokens"][number]>;
} {
    const persistedTokenIdx = state.tokens.findIndex(
        (token) => persistedTokenKey(token) === key,
    );
    const persistedToken = state.tokens[persistedTokenIdx];
    return { persistedTokenIdx, persistedToken };
}

/**
 * @yields Each parent of the given item.
 */
function* walkParents(items: Readonly<ItemMap>, item: Item) {
    const visited = new Set<Item["id"]>();
    let current: Item | undefined = item;
    while (current) {
        if (visited.has(current.id)) {
            break;
        }
        yield current;
        visited.add(current.id);
        current = current.attachedTo
            ? items.get(current.attachedTo)
            : undefined;
    }
}

/**
 * @yields The token and persisted token info for each parent of the given item which is
 *         persisted uniquely.
 */
function* walkParentPersistedUniqueTokens<S extends LocalStorage>(
    state: S,
    itemMap: ItemMap,
    item: Item,
): Generator<{
    token: Token;
    persistedToken: S["tokens"][number];
    persistedTokenIdx: number;
}> {
    for (const current of walkParents(itemMap, item)) {
        if (isToken(current)) {
            const { persistedToken, persistedTokenIdx } = getPersistedToken(
                state,
                current.image.url,
            );
            if (persistedToken && persistedToken.type === "UNIQUE") {
                yield { token: current, persistedToken, persistedTokenIdx };
            }
        }
    }
}

export const usePlayerStorage = create<LocalStorage & OwlbearStore>()(
    subscribeWithSelector(
        persist(
            immer((set) => ({
                // local storage
                contextMenuEnabled: true,
                tokens: [],
                setContextMenuEnabled: (contextMenuEnabled) =>
                    set({ contextMenuEnabled }),
                persist: (tokens) =>
                    set((state) => {
                        for (const { token, type, attachments } of tokens) {
                            // check if token is already persisted
                            const { persistedTokenIdx, persistedToken } =
                                getPersistedToken(state, tokenKey(token));
                            if (persistedToken?.type === "UNIQUE") {
                                console.warn("token is already persisted");
                                continue;
                            } else if (
                                persistedToken?.type === "TEMPLATE" &&
                                type === "TEMPLATE"
                            ) {
                                // update template
                                state.tokens[persistedTokenIdx] =
                                    persistedTokenUpdate(
                                        persistedToken,
                                        token,
                                        token.lastModified,
                                        attachments,
                                    );
                            } else if (!persistedToken) {
                                // no existing token
                                state.tokens.push({
                                    token,
                                    type,
                                    attachments: processAttachments(
                                        token,
                                        attachments,
                                    ),
                                });
                            }
                        }
                    }),
                setType: (key, type) =>
                    set((state) => {
                        const { persistedToken } = getPersistedToken(
                            state,
                            key,
                        );
                        if (persistedToken) {
                            persistedToken.type = type;
                        }
                    }),
                setTokenName: (key, name) =>
                    set((state) => {
                        const { persistedToken } = getPersistedToken(
                            state,
                            key,
                        );
                        if (persistedToken) {
                            persistedTokenSetName(persistedToken, name);
                        }
                    }),
                setTokenDisabledProperties: (key, disabledProperties) =>
                    set((state) => {
                        const { persistedToken } = getPersistedToken(
                            state,
                            key,
                        );
                        if (persistedToken) {
                            persistedToken.disabledProperties =
                                disabledProperties;
                        }
                    }),
                removeToken: (key) =>
                    set((state) => {
                        const { persistedTokenIdx } = getPersistedToken(
                            state,
                            key,
                        );
                        if (persistedTokenIdx > -1) {
                            state.tokens.splice(persistedTokenIdx, 1);
                        }
                    }),
                importTokens: (tokens) =>
                    set((state) => {
                        for (const token of tokens) {
                            const { persistedTokenIdx } = getPersistedToken(
                                state,
                                persistedTokenKey(token),
                            );
                            if (persistedTokenIdx > -1) {
                                state.tokens[persistedTokenIdx] = token;
                            } else {
                                state.tokens.push(token);
                            }
                        }
                    }),

                // owlbear store
                sceneReady: false,
                role: "PLAYER",
                items: new Map(),
                keyUsage: new Map(),
                theme: DEFAULT_THEME,
                // playerId: "NONE",
                grid: DEFAULT_GRID,
                // roomMetadata: { _key: true },
                setSceneReady: (sceneReady: boolean) =>
                    set((state) => {
                        state.sceneReady = sceneReady;
                        if (!sceneReady) {
                            state.items.clear();
                        }
                    }),
                setRole: (role: Role) => set({ role }),
                // setPlayerId: (playerId: string) => set({ playerId }),
                // setSelection: async (selection: string[] | undefined) => {
                //     if (selection && selection.length > 0) {
                //         return set({
                //             lastNonemptySelection: selection,
                //             lastNonemptySelectionItems:
                //                 await OBR.scene.items.getItems(selection),
                //         });
                //     }
                // },
                handleItemsChange: (items: Item[]) =>
                    set((state) => {
                        const tokens = items.filter(isToken);

                        state.keyUsage = getUrlUsage(tokens);
                        const prevItems = state.items;
                        state.items = toItemMap(items);

                        interface UpdatedUniqueToken {
                            token: Token;
                            lastModified: string;
                            uniquePersistedToken: WritableDraft<PersistedToken>;
                            persistedTokenIdx: number;
                        }
                        const updatedUniqueTokens = new Map<
                            Token["id"],
                            UpdatedUniqueToken
                        >();
                        /**
                         * Mark a unique token as updated. If it's already marked, the last modified date will be the
                         * max of the current date and the input date.
                         */
                        const addUpdatedUniqueToken = (
                            uniquePersistedToken: UpdatedUniqueToken,
                        ) => {
                            const existing = updatedUniqueTokens.get(
                                uniquePersistedToken.token.id,
                            );
                            if (existing) {
                                existing.lastModified = dateLte(
                                    existing.lastModified,
                                    uniquePersistedToken.lastModified,
                                )
                                    ? uniquePersistedToken.lastModified
                                    : existing.lastModified;
                            } else {
                                updatedUniqueTokens.set(
                                    uniquePersistedToken.token.id,
                                    uniquePersistedToken,
                                );
                            }
                        };

                        /**
                         * Tokens that were either just dragged out onto the map, or were just
                         * seen for the first time after a scene load.
                         */
                        const newTokens: Token[] = [];

                        // Update persisted tokens
                        for (const item of items) {
                            const lastModified = item.lastModified;

                            // skip unmodified items
                            const prevItem = prevItems.get(item.id);
                            if (
                                prevItem &&
                                dateLte(lastModified, prevItem.lastModified)
                            ) {
                                continue;
                            }

                            // record new tokens to update with metadata later
                            if (!prevItem && isToken(item)) {
                                newTokens.push(item);
                            }

                            // item is new or was updated. Find the unique tokens in chains it belongs to
                            // and schedule those unique tokens to save
                            for (const {
                                token,
                                persistedToken: uniquePersistedToken,
                                persistedTokenIdx,
                            } of walkParentPersistedUniqueTokens(
                                state,
                                state.items,
                                item,
                            )) {
                                // Skip saving the new token since it hasn't gotten its metadata yet.
                                if (!prevItem && token.id === item.id) {
                                    continue;
                                }

                                addUpdatedUniqueToken({
                                    token,
                                    lastModified,
                                    uniquePersistedToken,
                                    persistedTokenIdx,
                                });
                            }
                        }

                        // Look for deleted attachments
                        for (const item of prevItems.values()) {
                            if (!state.items.has(item.id)) {
                                // item was deleted. Mark all its parents that are persisted uniquely as
                                // needing an update
                                // TODO should this look up parents in prevItems instead? And mark
                                // items in the current set as updated if they still exist?
                                for (const {
                                    token,
                                    persistedToken: uniquePersistedToken,
                                    persistedTokenIdx,
                                } of walkParentPersistedUniqueTokens(
                                    state,
                                    state.items,
                                    item,
                                )) {
                                    addUpdatedUniqueToken({
                                        token,
                                        lastModified: new Date().toISOString(),
                                        uniquePersistedToken,
                                        persistedTokenIdx,
                                    });
                                }
                            }
                        }

                        // Update unique tokens
                        for (const {
                            token,
                            lastModified,
                            uniquePersistedToken,
                            persistedTokenIdx,
                        } of updatedUniqueTokens.values()) {
                            const usage =
                                state.keyUsage.get(tokenKey(token)) ?? 0;
                            // Is there exactly one of this token in the map to pull from?
                            if (usage === 1) {
                                state.tokens[persistedTokenIdx] =
                                    persistedTokenUpdate(
                                        uniquePersistedToken,
                                        token,
                                        lastModified,
                                        getAllAttachments(state.items, token),
                                    );
                            } else if (usage > 1) {
                                console.warn(
                                    `skipping updating unique token ${persistedTokenGetName(
                                        uniquePersistedToken,
                                    )} due to too many identical tokens`,
                                );
                            } // else if it's 0, the unique token was deleted
                        }

                        // Populate tokens from persisted data
                        if (state.role === "GM") {
                            void applyPersisted(newTokens);
                        }
                    }),
                // handleRoomMetadataChange: (metadata) => {
                //     const roomMetadata = metadata[METADATA_KEY_ROOM];
                //     if (isRoomMetadata(roomMetadata)) {
                //         set({ roomMetadata });
                //     }
                // },
                handleThemeChange: (theme) => set({ theme }),
            })),
            {
                name: LOCAL_STORAGE_STORE_NAME,
                partialize: partializeLocalStorage,
            },
        ),
    ),
);
