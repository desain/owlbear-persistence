import OBR, {
    isImage,
    type ContextMenuIconFilter,
    type Item,
    type Layer,
} from "@owlbear-rodeo/sdk";
import { getId } from "owlbear-utils";
import load from "../assets/load.svg";
import save from "../assets/save.svg";
import {
    ID_CONTEXTMENU_PERSIST,
    ID_CONTEXTMENU_RESET_TEMPLATE,
    ID_CONTEXTMENU_SAVE_TEMPLATE,
} from "../constants";
import {
    getPersistedToken,
    usePlayerStorage,
    type PersistedToken,
} from "../state/usePlayerStorage";
import { isToken } from "../Token";

export async function startWatchingContextMenuEnabled(): Promise<VoidFunction> {
    const state = usePlayerStorage.getState();
    if (state.contextMenuEnabled) {
        await installContextMenus(state.tokens);
    }
    return usePlayerStorage.subscribe(
        (store) => (store.contextMenuEnabled ? store.tokens : null),
        async (tokens) => {
            if (tokens) {
                await installContextMenus(tokens);
            } else {
                await uninstallContextMenus();
            }
        },
    );
}

function installContextMenus(tokens: PersistedToken[]) {
    return Promise.all([
        installPersistContextMenu(tokens),
        installTemplateContextMenus(tokens),
    ]);
}

function installPersistContextMenu(tokens: PersistedToken[]) {
    return OBR.contextMenu.create({
        id: ID_CONTEXTMENU_PERSIST,
        shortcut: undefined, // Watch out for collisions
        embed: undefined, // Prefer not to use this - it takes up space
        icons: [
            {
                icon: save,
                label: "Persist",
                filter: {
                    permissions: ["CREATE", "UPDATE"],
                    roles: ["GM"],
                    every: [
                        {
                            key: "type" satisfies keyof Item,
                            value: "IMAGE",
                        },
                        {
                            key: "layer" satisfies keyof Item,
                            operator: "!=",
                            value: "MAP" satisfies Layer,
                        },
                        ...tokens.map((token) => ({
                            key: ["image", "url"],
                            operator: "!=" as const,
                            value: token.imageUrl,
                        })),
                    ],
                },
            },
        ],
        onClick: async ({ items }) => {
            const tokens = items.filter(isToken);
            const selectedIds = new Set(tokens.map(getId));
            const alreadyUsedUrls = new Set(
                (await OBR.scene.items.getItems(isImage))
                    // look for non-selected items
                    .filter((item) => !selectedIds.has(getId(item)))
                    .map((item) => item.image.url),
            );
            usePlayerStorage.getState().persist(
                tokens.map((token) => ({
                    token,
                    type: alreadyUsedUrls.has(token.image.url)
                        ? "TEMPLATE"
                        : "UNIQUE",
                })),
            );
        },
    });
}

function installTemplateContextMenus(tokens: PersistedToken[]) {
    // If there are no template tokens, this menu never appears
    const templates = tokens.filter((token) => token.type === "TEMPLATE");
    if (templates.length === 0) {
        return uninstallTemplateContextMenus();
    }

    const templateFilter: ContextMenuIconFilter = {
        permissions: ["CREATE", "UPDATE"],
        roles: ["GM"],
        every: [
            ...templates.map((token) => ({
                key: ["image", "url"],
                value: token.imageUrl,
                coordinator: "||" as const,
            })),
        ],
    };

    return Promise.all([
        OBR.contextMenu.create({
            id: ID_CONTEXTMENU_SAVE_TEMPLATE,
            icons: [
                {
                    icon: save,
                    label: "Update Template",
                    filter: templateFilter,
                },
            ],
            onClick: ({ items }) => {
                const tokens = items.filter(isToken);
                usePlayerStorage.getState().persist(
                    tokens.map((token) => ({
                        token,
                        type: "TEMPLATE",
                    })),
                );
                const plural = items.length > 1;
                void OBR.player.deselect();
                void OBR.notification.show(
                    `Template${plural ? "s" : ""} updated!`,
                    "SUCCESS",
                );
            },
        }),
        OBR.contextMenu.create({
            id: ID_CONTEXTMENU_RESET_TEMPLATE,
            icons: [
                {
                    icon: load,
                    label: "Reset to Template",
                    filter: templateFilter,
                },
            ],
            onClick: async ({ items }) => {
                const state = usePlayerStorage.getState();
                await OBR.scene.items.updateItems(items, (items) =>
                    items.forEach((item) => {
                        if (!isToken(item)) {
                            return;
                        }
                        const persistedToken = getPersistedToken(
                            state,
                            item.image.url,
                        );
                        if (!persistedToken) {
                            return;
                        }
                        for (const [key, value] of Object.entries(
                            persistedToken.metadata,
                        )) {
                            item.metadata[key] = value;
                        }
                    }),
                );
                const plural = items.length > 1;
                void OBR.player.deselect();
                void OBR.notification.show(
                    `Reset item${plural ? "s" : ""} to template`,
                    "SUCCESS",
                );
            },
        }),
    ]);
}

function uninstallTemplateContextMenus() {
    return Promise.all([
        OBR.contextMenu.remove(ID_CONTEXTMENU_SAVE_TEMPLATE),
        OBR.contextMenu.remove(ID_CONTEXTMENU_RESET_TEMPLATE),
    ]);
}

function uninstallContextMenus() {
    return Promise.all([
        OBR.contextMenu.remove(ID_CONTEXTMENU_PERSIST),
        uninstallTemplateContextMenus(),
    ]);
}
