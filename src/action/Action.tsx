import {
    DeleteOutline,
    ExpandMore,
    Group,
    Person,
    Settings,
} from "@mui/icons-material";
import Edit from "@mui/icons-material/Edit";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    CardHeader,
    CardMedia,
    Divider,
    IconButton,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import type { ImageContent } from "@owlbear-rodeo/sdk";
import OBR from "@owlbear-rodeo/sdk";
import { Control, getId, useActionResizer, useRehydrate } from "owlbear-utils";
import React, { useRef, useState } from "react";
import { EXTENSION_NAME } from "../constants";
import { openSettings } from "../popoverSettings/openSettings";
import {
    usePlayerStorage,
    type PersistedToken,
    type PersistenceType,
} from "../state/usePlayerStorage";
import { isToken } from "../Token";

function formatTimestamp(ts?: number) {
    if (!ts) {
        return "";
    }
    try {
        const d = new Date(ts);
        return d.toLocaleString();
    } catch {
        return String(ts);
    }
}

function formatKb(s: string | undefined) {
    if (!s) {
        return "0 KB";
    }
    const bytes = new TextEncoder().encode(s).length;
    const kb = bytes / 1024;
    return `${kb.toFixed(2)} KB`;
}

function TokenCard({
    token,
    expanded,
    setExpanded,
}: {
    token: PersistedToken;
    expanded: boolean;
    setExpanded: (expanded: string | null) => void;
}) {
    const setType = usePlayerStorage((s) => s.setType);
    const setName = usePlayerStorage((s) => s.setTokenName);
    const removeToken = usePlayerStorage((s) => s.removeToken);

    async function handleSelect(url: ImageContent["url"]) {
        const items = await OBR.scene.items.getItems(
            (item) => isToken(item) && item.image.url === url,
        );
        if (items.length > 0) {
            await OBR.player.select(items.map(getId));
        }
    }

    return (
        <Accordion
            expanded={expanded}
            onChange={(_, isExpanded) =>
                setExpanded(isExpanded ? token.imageUrl : null)
            }
        >
            <AccordionSummary
                expandIcon={<ExpandMore />}
                slotProps={{ content: { sx: { m: 0 } } }}
            >
                <Stack direction="row" alignItems="center">
                    <CardMedia
                        component="img"
                        image={token.imageUrl}
                        alt={token.name}
                        sx={{
                            width: 48,
                            height: 48,
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            return handleSelect(token.imageUrl);
                        }}
                    />
                    <CardHeader
                        title={token.name}
                        subheader={formatKb(JSON.stringify(token.metadata))}
                        slotProps={{
                            title: {
                                variant: "body1",
                            },
                            subheader: {
                                variant: "caption",
                            },
                        }}
                    />
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                <Stack spacing={1}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <Control label="Persistence">
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={token.type}
                                onChange={(_, value) => {
                                    if (value) {
                                        setType(
                                            token.imageUrl,
                                            value as PersistenceType,
                                        );
                                    }
                                }}
                            >
                                <ToggleButton value="UNIQUE">
                                    <Tooltip title="Unique token (updates to the token are saved immediately)">
                                        <Person fontSize="small" />
                                    </Tooltip>
                                </ToggleButton>
                                <ToggleButton value="TEMPLATE">
                                    <Tooltip title="Template token (template must be updated manually)">
                                        <Group fontSize="small" />
                                    </Tooltip>
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Control>
                        <Control label="Rename">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    const newName = prompt(
                                        "New name:",
                                        token.name,
                                    );
                                    if (newName) {
                                        if (newName.length < 50) {
                                            setName(token.imageUrl, newName);
                                        }
                                    }
                                }}
                                aria-label="remove token"
                            >
                                <Edit fontSize="small" />
                            </IconButton>
                        </Control>
                        <Control label="Delete">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    const ok = window.confirm(
                                        `Remove token "${token.name}"?`,
                                    );
                                    if (ok) {
                                        removeToken(token.imageUrl);
                                    }
                                }}
                                aria-label="remove token"
                            >
                                <DeleteOutline fontSize="small" />
                            </IconButton>
                        </Control>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        Last modified {formatTimestamp(token.lastModified)}
                    </Typography>
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}

export function Action() {
    const box: React.RefObject<HTMLElement | null> = useRef(null);

    const [expanded, setExpanded] = useState<string | null>();

    const BASE_HEIGHT = 50;
    const MAX_HEIGHT = 700;
    useActionResizer(BASE_HEIGHT, MAX_HEIGHT, box);
    useRehydrate(usePlayerStorage);

    const role = usePlayerStorage((s) => s.role);
    const tokens = usePlayerStorage((store) => store.tokens);

    const tokensSorted = [...tokens].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );

    return role === "PLAYER" ? (
        <Alert severity="warning">
            This extension is for the GM's use only.
        </Alert>
    ) : (
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
                    <IconButton onClick={openSettings}>
                        <Settings />
                    </IconButton>
                }
            />
            <Divider sx={{ mb: 1 }} />

            <Stack spacing={1} sx={{ p: 0 }}>
                {tokensSorted.length === 0 ? (
                    <Typography color="text.secondary">
                        No tokens saved. Right click a token to persist it.
                    </Typography>
                ) : (
                    <Stack spacing={2}>
                        {tokensSorted.map((token) => (
                            <TokenCard
                                key={token.imageUrl}
                                expanded={expanded === token.imageUrl}
                                setExpanded={setExpanded}
                                token={token}
                            />
                        ))}
                        <Typography color="textSecondary">
                            Right click a token to persist it.
                        </Typography>
                    </Stack>
                )}
            </Stack>
        </Box>
    );
}
