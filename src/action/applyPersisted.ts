import type { Item } from "@owlbear-rodeo/sdk";
import OBR from "@owlbear-rodeo/sdk";
import { getId } from "owlbear-utils";
import {
    dateLte,
    persistedTokenFull,
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

function updateFromPersisted(
    overwriteTemplates: boolean,
    token: Token,
    persistedToken: PersistedToken,
) {
    /**
     * We can clobber existing values if:
     * - We're in overwrite templates mode (eg the user wants to reset to a template)
     * - It's a unique token and we have a more recent value
     * TODO: What about setting text etc for unique tokens just dragged out?
     */
    const canClobberValues =
        overwriteTemplates || isNewerUniqueToken(token, persistedToken);

    if (
        canClobberValues &&
        persistedTokenFull(persistedToken) &&
        !persistedToken.disabledProperties?.includes("TEXT")
    ) {
        token.text = persistedToken.token.text;
        token.textItemType = persistedToken.token.textItemType;
    }

    if (
        canClobberValues &&
        persistedTokenFull(persistedToken) &&
        !persistedToken.disabledProperties?.includes("DESCRIPTION")
    ) {
        token.description = persistedToken.token.description;
    }

    if (
        canClobberValues &&
        persistedTokenFull(persistedToken) &&
        !persistedToken.disabledProperties?.includes("LAYER")
    ) {
        token.layer = persistedToken.token.layer;
    }

    if (!persistedToken.disabledProperties?.includes("METADATA")) {
        for (const [key, value] of Object.entries(
            persistedTokenGetMetadata(persistedToken),
        )) {
            // We can write the metadata key if one of the following is true:
            // - We can clobber existing values
            // - it doesn't exist yet
            if (canClobberValues || !(key in token.metadata)) {
                token.metadata[key] = value;
            }
        }
    }
}

/**
 * @param tokens Tokens to apply persisted values to. Could be new, could
 *               be extant in a scene we just loaded, could be extant in
 *               the current scene and the user is resetting them to their
 *               templates.
 * @param overwriteTemplates Whether to clobber existing values.
 * @returns
 */
export async function applyPersisted(
    tokens: Token[],
    overwriteTemplates = false,
) {
    if (tokens.length === 0) {
        return;
    }

    const state = usePlayerStorage.getState();

    const updates = new Map<Token["id"], PersistedToken>();
    const oldAttachmentsToDelete: Item["id"][] = [];
    const newAttachmentsToAdd: Item[] = [];

    // Check which tokens need updates
    for (const token of tokens) {
        const { persistedToken } = getPersistedToken(state, token.image.url);
        if (persistedToken) {
            updates.set(token.id, persistedToken);

            // We want to replace attachments if:
            // - the token doesn't disable persisting attachments, AND one of the following:
            //   - we're allowed to overwrite templates
            //   - the token has no attachments yet
            //        (in which case nothing will be replaced, just maybe added)
            //   - it's a unique token and we have a more recent value
            const existingAttachments = (
                await OBR.scene.items.getItemAttachments([token.id])
            ).filter((a) => a.id !== token.id);

            if (
                !persistedToken.disabledProperties?.includes("ATTACHMENTS") &&
                (overwriteTemplates ||
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

                updateFromPersisted(overwriteTemplates, token, persistedToken);
            }),
        ),
        OBR.scene.items.deleteItems(oldAttachmentsToDelete),
        OBR.scene.items.addItems(newAttachmentsToAdd),
    ]);
}
