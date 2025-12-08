import {
    type ImageContent,
    type Item,
    type Metadata,
    type Theme,
} from "@owlbear-rodeo/sdk";
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
import { isToken, type Token } from "../Token";

enableMapSet();

export type PersistenceType = "TEMPLATE" | "UNIQUE";
export interface PersistedToken {
    readonly imageUrl: string;
    readonly name: string;
    readonly metadata: Metadata;
    readonly attachments?: Item[];
    /**
     * Whether to restore the token's attachments when restoring it.
     * Optional for backwards compatibility. If not present, read
     * as true.
     */
    readonly restoreAttachments?: boolean;
    readonly type: PersistenceType;
    readonly lastModified: number;
}

interface LocalStorage {
    readonly contextMenuEnabled: boolean;
    readonly tokens: PersistedToken[];
    readonly setContextMenuEnabled: (
        this: void,
        contextMenuEnabled: boolean,
    ) => void;
    readonly persist: (
        this: void,
        tokens: { token: Token; type: PersistenceType; attachments?: Item[] }[],
    ) => void;
    readonly setType: (
        this: void,
        url: ImageContent["url"],
        type: PersistenceType,
    ) => void;
    readonly setTokenName: (
        this: void,
        url: ImageContent["url"],
        name: string,
    ) => void;
    readonly setTokenRestoreAttachments: (
        this: void,
        url: ImageContent["url"],
        restoreAttachments: boolean,
    ) => void;
    readonly removeToken: (this: void, url: ImageContent["url"]) => void;
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
    readonly urlUsage: Map<ImageContent["url"], number>;
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

export function getPersistedToken<T extends LocalStorage>(
    state: T,
    url: ImageContent["url"],
): T["tokens"][number] | undefined {
    return state.tokens.find((token) => token.imageUrl === url);
}

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

function* walkParentPersistedUniqueTokens<S extends LocalStorage>(
    state: S,
    itemMap: ItemMap,
    item: Item,
): Generator<{ token: Token; persistedToken: S["tokens"][number] }> {
    for (const current of walkParents(itemMap, item)) {
        if (isToken(current)) {
            const persistedToken = getPersistedToken(state, current.image.url);
            if (persistedToken && persistedToken.type === "UNIQUE") {
                yield { token: current, persistedToken };
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
                            const persistedToken = getPersistedToken(
                                state,
                                token.image.url,
                            );
                            if (persistedToken?.type === "UNIQUE") {
                                console.warn("token is already persisted");
                                continue;
                            } else if (
                                persistedToken?.type === "TEMPLATE" &&
                                type === "TEMPLATE"
                            ) {
                                // update template
                                persistedToken.lastModified = Date.parse(
                                    token.lastModified,
                                );
                                persistedToken.metadata = token.metadata;
                                persistedToken.attachments = processAttachments(
                                    token,
                                    attachments,
                                );
                            } else if (!persistedToken) {
                                // no existing token
                                state.tokens.push({
                                    imageUrl: token.image.url,
                                    lastModified: Date.parse(
                                        token.lastModified,
                                    ),
                                    metadata: token.metadata,
                                    name: token.text.plainText || token.name,
                                    type,
                                    attachments: processAttachments(
                                        token,
                                        attachments,
                                    ),
                                });
                            }
                        }
                    }),
                setType: (url, type) =>
                    set((state) => {
                        const token = getPersistedToken(state, url);
                        if (token) {
                            token.type = type;
                        }
                    }),
                setTokenName: (url, name) =>
                    set((state) => {
                        const token = getPersistedToken(state, url);
                        if (token) {
                            token.name = name;
                        }
                    }),
                setTokenRestoreAttachments: (url, restoreAttachments) =>
                    set((state) => {
                        const token = getPersistedToken(state, url);
                        if (token) {
                            token.restoreAttachments = restoreAttachments;
                        }
                    }),
                removeToken: (url) =>
                    set((state) => {
                        const idx = state.tokens.findIndex(
                            (token) => token.imageUrl === url,
                        );
                        if (idx >= 0) {
                            state.tokens.splice(idx, 1);
                        }
                    }),

                // owlbear store
                sceneReady: false,
                role: "PLAYER",
                items: new Map(),
                urlUsage: new Map(),
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

                        state.urlUsage = getUrlUsage(tokens);
                        const prevItems = state.items;
                        state.items = toItemMap(items);

                        const updatedUniqueTokens = new Map<
                            Token["id"],
                            {
                                token: Token;
                                lastModified: number;
                                uniquePersistedToken: WritableDraft<PersistedToken>;
                            }
                        >();
                        const addUpdatedUniqueToken = (
                            token: Token,
                            lastModified: number,
                            uniquePersistedToken: WritableDraft<PersistedToken>,
                        ) => {
                            const existing = updatedUniqueTokens.get(token.id);
                            if (existing) {
                                existing.lastModified = Math.max(
                                    existing.lastModified,
                                    lastModified,
                                );
                            } else {
                                updatedUniqueTokens.set(token.id, {
                                    token,
                                    lastModified,
                                    uniquePersistedToken,
                                });
                            }
                        };
                        const newTokens: Token[] = [];

                        // Update persisted tokens
                        for (const item of items) {
                            const lastModified = Date.parse(item.lastModified);

                            // skip unmodified items
                            const prevItem = prevItems.get(item.id);
                            if (
                                prevItem &&
                                lastModified <=
                                    Date.parse(prevItem.lastModified)
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
                                persistedToken,
                            } of walkParentPersistedUniqueTokens(
                                state,
                                state.items,
                                item,
                            )) {
                                // Skip saving the new token since it hasn't gotten its metadata yet.
                                if (!prevItem && token.id === item.id) {
                                    continue;
                                }

                                addUpdatedUniqueToken(
                                    token,
                                    lastModified,
                                    persistedToken,
                                );
                            }
                        }

                        // Look for deleted attachments
                        for (const item of prevItems.values()) {
                            if (!state.items.has(item.id)) {
                                // item was deleted
                                for (const {
                                    token,
                                    persistedToken,
                                } of walkParentPersistedUniqueTokens(
                                    state,
                                    state.items,
                                    item,
                                )) {
                                    // does the parent still exist? if so, mark it for updating.
                                    addUpdatedUniqueToken(
                                        token,
                                        Date.now(),
                                        persistedToken,
                                    );
                                }
                            }
                        }

                        // Update unique tokens
                        for (const {
                            token,
                            lastModified,
                            uniquePersistedToken,
                        } of updatedUniqueTokens.values()) {
                            if (state.urlUsage.get(token.image.url) === 1) {
                                uniquePersistedToken.lastModified =
                                    lastModified;
                                uniquePersistedToken.metadata = token.metadata;
                                uniquePersistedToken.attachments =
                                    processAttachments(
                                        token,
                                        getAllAttachments(state.items, token),
                                    );
                            } else {
                                console.warn(
                                    `skipping updating unique token ${uniquePersistedToken.name} due to too many identical tokens`,
                                );
                            }
                        }

                        // Populate new tokens from persisted data
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
