import { Settings } from "@mui/icons-material";
import { Box, CardHeader, IconButton, Tooltip } from "@mui/material";
import { useActionResizer, useRehydrate } from "owlbear-utils";
import { useRef } from "react";
import { EXTENSION_NAME } from "../constants";
import { openSettings } from "../popoverSettings/openSettings";
import { usePlayerStorage } from "../state/usePlayerStorage";

export function Action() {
    const box: React.RefObject<HTMLElement | null> = useRef(null);

    const BASE_HEIGHT = 300;
    const MAX_HEIGHT = 700;
    useActionResizer(BASE_HEIGHT, MAX_HEIGHT, box);
    useRehydrate(usePlayerStorage);

    return (
        <Box ref={box}>
            <CardHeader
                title={EXTENSION_NAME}
                slotProps={{
                    title: {
                        sx: {
                            fontSize: "1.125rem",
                            fontWeight: "bold",
                            lineHeight: "32px",
                            color: "text.primary",
                        },
                    },
                }}
                action={
                    <Tooltip title="Settings">
                        <IconButton onClick={openSettings}>
                            <Settings />
                        </IconButton>
                    </Tooltip>
                }
            />
        </Box>
    );
}
