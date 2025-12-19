import type { Item } from "@owlbear-rodeo/sdk";
import type { Token } from "../Token";
import { ATTACHED_TO_ROOT } from "../constants";

export function processAttachments(
    token: Token,
    attachments?: readonly Readonly<Item>[],
): Item[] | undefined {
    if (!attachments) {
        return attachments;
    }
    return attachments.map((attachment) => ({
        ...attachment,
        attachedTo:
            attachment.attachedTo === token.id
                ? ATTACHED_TO_ROOT
                : attachment.attachedTo,
        zIndex: attachment.zIndex - token.zIndex,
        position: {
            x: attachment.position.x - token.position.x,
            y: attachment.position.y - token.position.y,
        },
    }));
}

export function restoreAttachments(
    token: Token,
    attachments?: readonly Readonly<Item>[],
): Item[] | undefined {
    if (!attachments) {
        return attachments;
    }

    const idMap = new Map<Item["id"], Item["id"]>();
    idMap.set(ATTACHED_TO_ROOT, token.id);
    for (const attachment of attachments) {
        idMap.set(attachment.id, crypto.randomUUID());
    }

    return attachments.map((attachment) => ({
        ...attachment,
        attachedTo: attachment.attachedTo
            ? idMap.get(attachment.attachedTo)
            : undefined,
        zIndex: attachment.zIndex + token.zIndex,
        id: idMap.get(attachment.id) ?? attachment.id,
        position: {
            x: attachment.position.x + token.position.x,
            y: attachment.position.y + token.position.y,
        },
    }));
}
