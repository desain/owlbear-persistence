import OBR from "@owlbear-rodeo/sdk";
import { deferCallAll, DO_NOTHING } from "owlbear-utils";
import { version } from "../package.json";
import { installActionIconWatcher } from "./action/actionIconWatcher";
import { installBroadcastListener } from "./broadcast/broadcast";
import { EXTENSION_NAME } from "./constants";
import { startWatchingContextMenuEnabled } from "./contextmenu/contextmenu";

export function install() {
    async function installExtension(): Promise<VoidFunction> {
        console.log(`${EXTENSION_NAME} version ${version}`);

        if ((await OBR.player.getRole()) !== "GM") {
            return DO_NOTHING;
        }

        const stopWatchingContextMenu = await startWatchingContextMenuEnabled();
        const uninstallBroadcastListener = installBroadcastListener();
        const uninstallActionIconWatcher = installActionIconWatcher();

        return deferCallAll(
            () => console.log(`Uninstalling ${EXTENSION_NAME}`),
            stopWatchingContextMenu,
            uninstallBroadcastListener,
            uninstallActionIconWatcher,
        );
    }

    OBR.onReady(async () => {
        await installExtension();
    });
}
