import type { Item, Metadata } from "@owlbear-rodeo/sdk";
import type { WritableDraft } from "immer";
import { tokenKey, type Token } from "../Token";
import { processAttachments } from "../action/processAttachments";

interface PersistedTokenBase {
    readonly attachments?: Item[];
    /**
     * Whether to restore the token's attachments when restoring it.
     * Optional for backwards compatibility. If not present, read
     * as true.
     */
    readonly restoreAttachments?: boolean;
    readonly type: PersistenceType;
}

interface PersistDataV1 {
    readonly name: string;
    readonly metadata: Metadata;
    readonly lastModified: number;
    readonly imageUrl: string;
}

interface PersistDataV2 {
    readonly token: Readonly<Token>;
}

export type PersistenceType = "TEMPLATE" | "UNIQUE";

export type PersistedToken = PersistedTokenBase &
    (PersistDataV1 | PersistDataV2);

export function persistedTokenFull(
    persistedToken: PersistedToken,
): persistedToken is PersistedTokenBase & PersistDataV2 {
    return "token" in persistedToken;
}

export function persistedTokenKey(persistedToken: PersistedToken) {
    return persistedTokenFull(persistedToken)
        ? tokenKey(persistedToken.token)
        : persistedToken.imageUrl;
}

export function persistedTokenSaveToken(
    persistedToken: WritableDraft<PersistedToken>,
    token: Token,
    lastModified: string,
    attachments?: Item[],
) {
    persistedTokenSetLastModified(persistedToken, lastModified);
    persistedTokenSetMetadata(persistedToken, token.metadata);
    persistedToken.attachments = processAttachments(token, attachments);
}

export function persistedTokenGetMetadata(persistedToken: PersistedToken) {
    return persistedTokenFull(persistedToken)
        ? persistedToken.token.metadata
        : persistedToken.metadata;
}

export function persistedTokenSetMetadata(
    persistedToken: WritableDraft<PersistedToken>,
    metadata: Metadata,
) {
    if (persistedTokenFull(persistedToken)) {
        persistedToken.token.metadata = metadata as Token["metadata"];
    } else {
        persistedToken.metadata = metadata;
    }
}

export function persistedTokenGetName(
    persistedToken: WritableDraft<PersistedToken>,
) {
    return persistedTokenFull(persistedToken)
        ? persistedToken.token.name
        : persistedToken.name;
}

export function persistedTokenSetName(
    persistedToken: WritableDraft<PersistedToken>,
    name: string,
) {
    if (persistedTokenFull(persistedToken)) {
        persistedToken.token.name = name;
    } else {
        persistedToken.name = name;
    }
}

export function persistedTokenGetLastModified(persistedToken: PersistedToken) {
    return persistedTokenFull(persistedToken)
        ? new Date(persistedToken.token.lastModified)
        : new Date(persistedToken.lastModified);
}

export function persistedTokenSetLastModified(
    persistedToken: WritableDraft<PersistedToken>,
    lastModified: string,
) {
    if (persistedTokenFull(persistedToken)) {
        persistedToken.token.lastModified = lastModified;
    } else {
        persistedToken.lastModified = Date.parse(lastModified);
    }
}

export function dateLte(a: string | Date, b: string | Date) {
    const aDate = typeof a === "string" ? new Date(a) : a;
    const bDate = typeof b === "string" ? new Date(b) : b;
    return aDate.getTime() <= bDate.getTime();
}
