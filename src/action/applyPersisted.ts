import type { Image, Item } from "@owlbear-rodeo/sdk";
import OBR from "@owlbear-rodeo/sdk";
import { getId } from "owlbear-utils";
import {
    dateLte,
    persistedTokenGetLastModified,
    persistedTokenGetMetadata,
    type PersistedToken,
} from "../state/PersistedToken";
import { getPersistedToken, usePlayerStorage } from "../state/usePlayerStorage";
import { isToken, type Token } from "../Token";
import { restoreAttachments } from "./processAttachments";

/**
 * @param token Map token
 * @param persistedToken Persisted token
 * @returns Whether the persisted token is supposed to be unique and is newer than
 *          the token on the map.
 */
function isNewerUniqueToken(token: Token, persistedToken: PersistedToken) {
    return (
        persistedToken.type === "UNIQUE" &&
        !dateLte(
            persistedTokenGetLastModified(persistedToken),
            token.lastModified,
        )
    );
}

/**
 * @param tokens Tokens to apply persisted values to. Could be new, could
 *               be extant in a scene we just loaded, could be extant in
 *               the current scene and the user is resetting them to their
 *               templates.
 * @param overwrite Whether to clobber existing values.
 * @returns
 */
export async function applyPersisted(tokens: Token[], overwrite?: boolean) {
    if (tokens.length === 0) {
        return;
    }

    const state = usePlayerStorage.getState();

    const updates = new Map<Image["id"], PersistedToken>();
    const oldAttachmentsToDelete: Item["id"][] = [];
    const newAttachmentsToAdd: Item[] = [];
    for (const token of tokens) {
        const { persistedToken } = getPersistedToken(state, token.image.url);
        if (persistedToken) {
            updates.set(token.id, persistedToken);

            // We want to replace attachments if:
            // - the token doesn't want to drop attachments, AND one of the following:
            //   - we're in overwrite mode
            //   - the token has no attachments yet
            //        (in which case nothing will be replaced, just maybe added)
            //   - it's a unique token and we have a more recent value
            const existingAttachments = (
                await OBR.scene.items.getItemAttachments([token.id])
            ).filter((a) => a.id !== token.id);

            if (
                (persistedToken.restoreAttachments ?? true) &&
                (overwrite ||
                    existingAttachments.length === 0 ||
                    isNewerUniqueToken(token, persistedToken))
            ) {
                oldAttachmentsToDelete.push(...existingAttachments.map(getId));
                newAttachmentsToAdd.push(
                    ...(restoreAttachments(token, persistedToken.attachments) ??
                        []),
                );
            }
        }
    }

    // apply metadata
    await Promise.all([
        OBR.scene.items.updateItems([...updates.keys()], (newTokens) =>
            newTokens.forEach((token) => {
                const persistedToken = updates.get(token.id);
                if (!persistedToken || !isToken(token)) {
                    return;
                }

                for (const [key, value] of Object.entries(
                    persistedTokenGetMetadata(persistedToken),
                )) {
                    // We can write the metadata key if one of the following is true:
                    // - we're in overwrite mode
                    // - it doesn't exist yet
                    // - it's a unique token and we have a more recent value
                    if (
                        overwrite ||
                        !(key in token.metadata) ||
                        isNewerUniqueToken(token, persistedToken)
                    ) {
                        token.metadata[key] = value;
                    }
                }
            }),
        ),
        OBR.scene.items.deleteItems(oldAttachmentsToDelete),
        OBR.scene.items.addItems(newAttachmentsToAdd),
    ]);
}
