import Upload from "@mui/icons-material/Upload";
import IconButton from "@mui/material/IconButton";
import OBR from "@owlbear-rodeo/sdk";
import { complain } from "owlbear-utils";
import type React from "react";
import { useRef } from "react";
import {
    isPersistedTokenArray,
    persistedTokenKey,
} from "../state/PersistedToken";
import { usePlayerStorage } from "../state/usePlayerStorage";

const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result;

        try {
            if (typeof text !== "string") {
                throw Error("Cannot read non-string file text");
            }

            const importedTokens: unknown = JSON.parse(text);
            if (
                !isPersistedTokenArray(importedTokens) ||
                importedTokens.length < 1
            ) {
                throw Error(
                    "Invalid JSON file; must contain persisted token list.",
                );
            }

            const { tokens: currentTokens, importTokens } =
                usePlayerStorage.getState();
            const currentKeys = new Set(currentTokens.map(persistedTokenKey));
            const collision = importedTokens.some((t) =>
                currentKeys.has(persistedTokenKey(t)),
            );

            if (
                collision &&
                !window.confirm("Some tokens will be replaced. Continue?")
            ) {
                return;
            }
            importTokens(importedTokens);
            const plural = importedTokens.length !== 1;
            void OBR.notification.show(
                `Successfully uploaded ${importedTokens.length} token${
                    plural ? "s" : ""
                }`,
                "SUCCESS",
            );
        } catch (e) {
            complain(e);
        }
    };
    reader.readAsText(file);
    // reset input
    event.target.value = "";
};

export const UploadButton: React.FC = () => {
    const uploadRef = useRef<HTMLInputElement>(null);
    return (
        <>
            <IconButton
                title="Upload extra tokens"
                onClick={() => uploadRef.current?.click()}
            >
                <Upload />
            </IconButton>
            <input
                type="file"
                accept=".json"
                ref={uploadRef}
                style={{ display: "none" }}
                onChange={handleUpload}
            />
        </>
    );
};
