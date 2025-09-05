import type { Image } from "@owlbear-rodeo/sdk";
import OBR from "@owlbear-rodeo/sdk";
import {
    getPersistedToken,
    usePlayerStorage,
    type PersistedToken,
} from "../state/usePlayerStorage";

export async function handleNewTokens(newTokens: Image[]) {
    if (newTokens.length === 0) {
        return;
    }

    const state = usePlayerStorage.getState();

    const updates = new Map<Image["id"], PersistedToken>();
    for (const token of newTokens) {
        const persistedToken = getPersistedToken(state, token.image.url);
        if (persistedToken) {
            updates.set(token.id, persistedToken);
        }
    }

    await OBR.scene.items.updateItems([...updates.keys()], (newTokens) =>
        newTokens.forEach((token) => {
            const persistedToken = updates.get(token.id);
            if (persistedToken) {
                for (const [key, value] of Object.entries(
                    persistedToken.metadata,
                )) {
                    // We can write the metadata key if:
                    // - it's a unique token and we have a more recent value
                    // - it's a template token and the value isn't there yet
                    if (
                        (persistedToken.type === "UNIQUE" &&
                            Date.parse(token.lastModified) <
                                persistedToken.lastModified) ||
                        (persistedToken.type === "TEMPLATE" &&
                            !(key in token.metadata))
                    ) {
                        token.metadata[key] = value;
                    }
                }
            }
        }),
    );
}
