import OBR from "@owlbear-rodeo/sdk";
import { deferCallAll } from "owlbear-utils";
import { usePlayerStorage } from "./usePlayerStorage";

const sceneReady = new Promise<void>((resolve) => {
    OBR.onReady(async () => {
        if (await OBR.scene.isReady()) {
            resolve();
        } else {
            const unsub = OBR.scene.onReadyChange((ready) => {
                if (ready) {
                    unsub();
                    resolve();
                }
            });
        }
    });
});

/**
 * @returns [Promise that resolves once store has initialized, function to stop syncing]
 */
export function startSyncing(): [
    initialized: Promise<void>,
    unsubscribe: VoidFunction,
] {
    // console.log("startSyncing");
    const { setSceneReady, setRole, handleItemsChange, handleThemeChange } =
        usePlayerStorage.getState();

    const sceneReadyInitialized = OBR.scene.isReady().then(setSceneReady);
    const unsubscribeSceneReady = OBR.scene.onReadyChange(setSceneReady);

    const roleInitialized = OBR.player.getRole().then(setRole);
    // const playerIdInitialized = OBR.player.getId().then(setPlayerId);
    // const selectionInitialized = OBR.player
    //     .getSelection()
    //     .then(store.setSelection);
    const unsubscribePlayer = OBR.player.onChange((player) => {
        setRole(player.role);
        // setPlayerId(player.id);
        // void setSelection(player.selection);
    });

    // const gridInitialized = Promise.all([
    //     OBR.scene.grid.getDpi(),
    //     OBR.scene.grid.getMeasurement(),
    //     OBR.scene.grid.getType(),
    // ]).then(([dpi, measurement, type]) =>
    //     setGrid({ dpi, measurement, type }),
    // );
    // const unsubscribeGrid = OBR.scene.grid.onChange(setGrid);

    // const roomMetadataInitialized = OBR.room.getMetadata().then(handleRoomMetadataChange);
    // const unsubscribeRoomMetadata = OBR.room.onMetadataChange(handleRoomMetadataChange);

    const itemsInitialized = sceneReady
        .then(() => OBR.scene.items.getItems())
        .then(handleItemsChange);
    const unsubscribeItems = OBR.scene.items.onChange(handleItemsChange);

    const themeInitialized = OBR.theme.getTheme().then(handleThemeChange);
    const unsubscribeTheme = OBR.theme.onChange(handleThemeChange);

    return [
        Promise.all([
            sceneReadyInitialized,
            roleInitialized,
            // playerIdInitialized,
            itemsInitialized,
            // gridInitialized,
            // roomMetadataInitialized,
            themeInitialized,
        ]).then(() => void 0),
        deferCallAll(
            unsubscribeSceneReady,
            unsubscribePlayer,
            // unsubscribeGrid,
            unsubscribeItems,
            // unsubscribeRoomMetadata,
            unsubscribeTheme,
        ),
    ];
}
