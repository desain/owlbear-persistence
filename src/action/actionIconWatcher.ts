import OBR from "@owlbear-rodeo/sdk";
import { usePlayerStorage } from "../state/usePlayerStorage";

function anyTokenOverused(state: ReturnType<typeof usePlayerStorage.getState>) {
    return state.tokens.some(
        (token) =>
            token.type === "UNIQUE" &&
            (state.urlUsage.get(token.imageUrl) ?? 0) > 1,
    );
}

function handleOverusedState(anyTokenOverused: boolean) {
    if (anyTokenOverused) {
        void OBR.action.setBadgeText("!");
        // void OBR.action.setBadgeBackgroundColor("#ff0000");
    } else {
        void OBR.action.setBadgeText();
    }
}

export function installActionIconWatcher() {
    handleOverusedState(anyTokenOverused(usePlayerStorage.getState()));
    return usePlayerStorage.subscribe(anyTokenOverused, handleOverusedState);
}
