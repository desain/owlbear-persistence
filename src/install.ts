import OBR from "@owlbear-rodeo/sdk";
import { deferCallAll } from "owlbear-utils";
import { version } from "../package.json";
import { installBroadcastListener } from "./broadcast/broadcast";
import { EXTENSION_NAME } from "./constants";
import { startWatchingContextMenuEnabled } from "./contextmenu/contextmenu";

export function install() {
    async function installExtension(): Promise<VoidFunction> {
        console.log(`${EXTENSION_NAME} version ${version}`);

        if ((await OBR.player.getRole()) !== "GM") {
            return () => {
                // player instance has no cleanup
            };
        }

        const stopWatchingContextMenu = await startWatchingContextMenuEnabled();
        const uninstallBroadcastListener = installBroadcastListener();

        return deferCallAll(
            () => console.log(`Uninstalling ${EXTENSION_NAME}`),
            stopWatchingContextMenu,
            uninstallBroadcastListener,
        );
    }

    OBR.onReady(async () => {
        await installExtension();
    });
}
