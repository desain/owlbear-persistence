import type { Item } from "@owlbear-rodeo/sdk";
import { getOrInsert } from "owlbear-utils";

export type ItemMap<ItemType extends Item = Item> = Map<
    ItemType["id"],
    ItemType
>;

export function toItemMap<ItemType extends Item = Item>(
    items: readonly ItemType[],
): ItemMap<ItemType> {
    return new Map(items.map((item) => [item.id, item]));
}

export function getAllAttachments<ItemType extends Item>(
    items: ItemMap<ItemType>,
    root: Readonly<ItemType>,
): ItemType[] {
    const children = new Map<ItemType["id"], ItemType[]>();
    for (const item of items.values()) {
        if (item.attachedTo) {
            getOrInsert(children, item.attachedTo, () => []).push(item);
        }
    }

    const visited = new Set<ItemType["id"]>();
    function childrenOf(item: ItemType): ItemType[] {
        // skip children already seen through another path
        if (visited.has(item.id)) {
            return [];
        }
        visited.add(item.id);
        return (children.get(item.id) ?? [])
            .filter((child) => !visited.has(child.id))
            .map((child) => [child, ...childrenOf(child)])
            .flat();
    }

    return childrenOf(root);
}

export interface ItemDiff<ItemType extends Item = Item> {
    readonly createdItems: ReadonlySet<ItemType>;
    readonly deletedItems: ReadonlySet<ItemType["id"]>;
    readonly updatedItems: readonly ItemType[];
}

export function diffItems<ItemType extends Item = Item>(
    oldItems: ItemMap<ItemType>,
    newItems: ItemMap<ItemType>,
): ItemDiff<ItemType> {
    const deletedItems = new Set(oldItems.keys());
    const createdItems = new Set(newItems.values());
    const updatedItems: ItemType[] = [];

    for (const oldItem of oldItems.values()) {
        if (newItems.has(oldItem.id)) {
            deletedItems.delete(oldItem.id);
        }
    }

    for (const newItem of newItems.values()) {
        const oldItem = oldItems.get(newItem.id);
        if (oldItem) {
            createdItems.delete(newItem);
            if (oldItem.lastModified < newItem.lastModified) {
                updatedItems.push(newItem);
            }
        }
    }

    return { createdItems, updatedItems, deletedItems };
}
