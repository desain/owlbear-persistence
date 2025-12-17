import type { Item, Metadata } from "@owlbear-rodeo/sdk";
import type { WritableDraft } from "immer";
import {
    containsImplies,
    isBoolean,
    isItem,
    isObject,
    isString,
} from "owlbear-utils";
import { isToken, tokenKey, type Token } from "../Token";
import { processAttachments } from "../action/processAttachments";

const PERSISTED_PROPERTIES = [
    "METADATA",
    "ATTACHMENTS",
    "TEXT",
    "LAYER",
    "DESCRIPTION",
] as const;

export type PersistedProperty = (typeof PERSISTED_PROPERTIES)[number];

export function isPersistedProperty(p: unknown): p is PersistedProperty {
    const pp: readonly unknown[] = PERSISTED_PROPERTIES;
    return pp.includes(p);
}

export function invertPersistedProperties(
    props?: readonly PersistedProperty[],
): PersistedProperty[] {
    return PERSISTED_PROPERTIES.filter((p) => !props?.includes(p));
}

interface PersistedTokenBase {
    readonly attachments?: Item[];
    /**
     * Properties to NOT restore. Should contain each property at most once.
     * If not present, treat as empty.
     * Array, not Set, for serialization.
     */
    readonly disabledProperties?: PersistedProperty[];
    /**
     * Which groups the token is in. Read undefined as no groups.
     */
    readonly groups?: string[];
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

export function isPersistenceType(t: unknown): t is PersistenceType {
    return t === "TEMPLATE" || t === "UNIQUE";
}

export type PersistedToken = PersistedTokenBase &
    (PersistDataV1 | PersistDataV2);

export function isPersistedToken(t: unknown): t is PersistedToken {
    const hasBase =
        isObject(t) &&
        containsImplies(
            t,
            "attachments",
            (a) => Array.isArray(a) && a.every(isItem),
        ) &&
        containsImplies(t, "restoreAttachments", isBoolean) &&
        containsImplies(
            t,
            "groups",
            (g) => Array.isArray(g) && g.every(isString),
        ) &&
        "type" in t &&
        isPersistenceType(t.type);
    const hasPersistDataV1 =
        hasBase &&
        "name" in t &&
        typeof t.name === "string" &&
        "metadata" in t &&
        isObject(t.metadata) &&
        "lastModified" in t &&
        typeof t.lastModified === "number" &&
        "imageUrl" in t &&
        typeof t.imageUrl === "string";
    const hasPersistDataV2 =
        hasBase && "token" in t && isItem(t.token) && isToken(t.token);
    return hasPersistDataV1 || hasPersistDataV2;
}

export function isPersistedTokenArray(a: unknown): a is PersistedToken[] {
    return Array.isArray(a) && a.every(isPersistedToken);
}

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

export function persistedTokenUpdate(
    { disabledProperties, type, groups }: PersistedToken,
    token: Token,
    lastModified: string,
    attachments?: Item[],
): PersistedToken {
    return {
        type,
        groups,
        disabledProperties,
        token: { ...token, lastModified },
        attachments: processAttachments(token, attachments),
    };
}

export function persistedTokenGetMetadata(persistedToken: PersistedToken) {
    return persistedTokenFull(persistedToken)
        ? persistedToken.token.metadata
        : persistedToken.metadata;
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

export function dateLte(a: string | Date, b: string | Date) {
    const aDate = typeof a === "string" ? new Date(a) : a;
    const bDate = typeof b === "string" ? new Date(b) : b;
    return aDate.getTime() <= bDate.getTime();
}
