import {
    isImage,
    type Image,
    type Item,
    type Metadata,
} from "@owlbear-rodeo/sdk";
import { type HasParameterizedMetadata } from "owlbear-utils";
import { METADATA_KEY_PERSISTED } from "./constants";

export type Token = Image &
    HasParameterizedMetadata<
        typeof METADATA_KEY_PERSISTED,
        (keyof Metadata)[] | undefined
    >;

export function isToken(item: Item): item is Token {
    const persistedKeys = item.metadata[METADATA_KEY_PERSISTED];
    return (
        isImage(item) &&
        (persistedKeys === undefined ||
            (Array.isArray(persistedKeys) &&
                persistedKeys.every((s) => typeof s === "string")))
    );
}

export function tokenKey(token: Token) {
    return token.image.url;
}
