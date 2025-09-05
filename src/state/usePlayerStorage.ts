import {
    type Image,
    type ImageContent,
    type Item,
    type Metadata,
    type Theme,
} from "@owlbear-rodeo/sdk";
import { enableMapSet } from "immer";
import { WHITE_HEX, type ExtractNonFunctions, type Role } from "owlbear-utils";
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { handleNewTokens } from "../action/applyPersisted";
import { LOCAL_STORAGE_STORE_NAME } from "../constants";
import { isToken, type Token } from "../Token";

enableMapSet();

export type PersistenceType = "TEMPLATE" | "UNIQUE";
export interface PersistedToken {
    readonly imageUrl: string;
    readonly name: string;
    readonly metadata: Metadata;
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
        tokens: { token: Token; type: PersistenceType }[],
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
    readonly removeToken: (this: void, url: ImageContent["url"]) => void;
}
function partializeLocalStorage({
    contextMenuEnabled,
    tokens,
}: LocalStorage): ExtractNonFunctions<LocalStorage> {
    return { contextMenuEnabled, tokens };
}

interface OwlbearStore {
    readonly sceneReady: boolean;
    readonly role: Role;
    readonly theme: Theme;
    // readonly playerId: string;
    // readonly grid: GridParsed;
    readonly images: Map<Image["id"], number>;
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
                        for (const { token, type } of tokens) {
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
                images: new Map(),
                theme: {
                    background: {
                        default: WHITE_HEX,
                        paper: WHITE_HEX,
                    },
                    text: {
                        primary: WHITE_HEX,
                        secondary: WHITE_HEX,
                        disabled: WHITE_HEX,
                        hint: WHITE_HEX,
                    },
                    mode: "DARK",
                    primary: {
                        contrastText: WHITE_HEX,
                        dark: WHITE_HEX,
                        light: WHITE_HEX,
                        main: WHITE_HEX,
                    },
                    secondary: {
                        contrastText: WHITE_HEX,
                        dark: WHITE_HEX,
                        light: WHITE_HEX,
                        main: WHITE_HEX,
                    },
                },
                // playerId: "NONE",
                // grid: {
                //     dpi: -1,
                //     measurement: "CHEBYSHEV",
                //     type: "SQUARE",
                //     parsedScale: {
                //         digits: 1,
                //         unit: "ft",
                //         multiplier: 5,
                //     },
                // },
                // roomMetadata: { _key: true },
                setSceneReady: (sceneReady: boolean) =>
                    set((state) => {
                        state.sceneReady = sceneReady;
                        if (!sceneReady) {
                            state.images.clear();
                        }
                    }),
                setRole: (role: Role) => set({ role }),
                // setPlayerId: (playerId: string) => set({ playerId }),
                // setGrid: async (grid: GridParams) => {
                //     const parsedScale = (await OBR.scene.grid.getScale())
                //         .parsed;
                //     return set({
                //         grid: {
                //             dpi: grid.dpi,
                //             measurement: grid.measurement,
                //             type: grid.type,
                //             parsedScale,
                //         },
                //     });
                // },
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
                        const images = items.filter(isToken);

                        const newImages: Image[] = [];
                        // Update persisted tokens
                        for (const image of images) {
                            const lastModified = Date.parse(image.lastModified);
                            const prevLastModified = state.images.get(image.id);

                            if (prevLastModified !== undefined) {
                                // image already existed
                                if (prevLastModified < lastModified) {
                                    // image was updated
                                    const token = getPersistedToken(
                                        state,
                                        image.image.url,
                                    );
                                    if (token && token.type === "UNIQUE") {
                                        token.lastModified = lastModified;
                                        token.metadata = image.metadata;
                                    }
                                }
                            } else {
                                // image is new
                                newImages.push(image);
                            }
                        }

                        // Save existing images for next time
                        state.images = new Map(
                            images.map(({ id, lastModified }) => [
                                id,
                                Date.parse(lastModified),
                            ]),
                        );

                        // Populate new tokens from persisted data
                        if (state.role === "GM") {
                            void handleNewTokens(newImages);
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
