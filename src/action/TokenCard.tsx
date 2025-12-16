import {
    DeleteOutline,
    Edit,
    ExpandMore,
    Group,
    Person,
    Warning,
} from "@mui/icons-material";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Badge,
    CardHeader,
    CardMedia,
    IconButton,
    Stack,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import type { Range } from "@nozbe/microfuzz";
import { Highlight } from "@nozbe/microfuzz/react";
import OBR, { type ImageContent } from "@owlbear-rodeo/sdk";
import { filesize } from "filesize";
import { Control, getId } from "owlbear-utils";
import type React from "react";
import {
    persistedTokenGetLastModified,
    persistedTokenGetName,
    persistedTokenKey,
    type PersistedToken,
    type PersistenceType,
} from "../state/PersistedToken";
import { usePlayerStorage } from "../state/usePlayerStorage";
import { isToken } from "../Token";

function formatTimestamp(ts?: Date) {
    if (!ts) {
        return "";
    }
    try {
        return ts.toLocaleString();
    } catch {
        return String(ts);
    }
}

interface TokenCardProps {
    token: PersistedToken;
    size: number;
    expanded: boolean;
    setExpanded: (expanded: string | null) => void;
    highlightRanges?: Range[];
}

export const TokenCard: React.FC<TokenCardProps> = ({
    token,
    size,
    expanded,
    setExpanded,
    highlightRanges,
}) => {
    const setType = usePlayerStorage((s) => s.setType);
    const setName = usePlayerStorage((s) => s.setTokenName);
    const setRestoreAttachments = usePlayerStorage(
        (s) => s.setTokenRestoreAttachments,
    );
    const removeToken = usePlayerStorage((s) => s.removeToken);
    const keyUsage = usePlayerStorage((s) => s.keyUsage);

    const key = persistedTokenKey(token);
    const name = persistedTokenGetName(token);

    async function handleSelect(url: ImageContent["url"]) {
        if (!usePlayerStorage.getState().sceneReady) {
            // can't focus a token if the scene is gone
            return;
        }
        const items = await OBR.scene.items.getItems(
            (item) => isToken(item) && item.image.url === url,
        );
        if (items.length > 0) {
            const bounds = await OBR.scene.items.getItemBounds(
                items.map(getId),
            );
            await Promise.all([
                OBR.player.select(items.map(getId)),
                OBR.viewport.animateToBounds(bounds),
            ]);
        }
    }

    const image = (
        <CardMedia
            component="img"
            image={key}
            alt={name}
            sx={{
                width: 48,
                height: 48,
            }}
            onClick={(e) => {
                e.stopPropagation();
                return handleSelect(key);
            }}
        />
    );

    const hasWarning = token.type === "UNIQUE" && (keyUsage.get(key) ?? 0) > 1;

    return (
        <Accordion
            expanded={expanded}
            onChange={(_, isExpanded) => setExpanded(isExpanded ? key : null)}
        >
            <AccordionSummary
                expandIcon={<ExpandMore />}
                slotProps={{ content: { sx: { m: 0 } } }}
            >
                <Stack direction="row" alignItems="center">
                    {hasWarning ? (
                        <Badge
                            color="warning"
                            overlap="circular"
                            badgeContent={<Warning fontSize="small" />}
                        >
                            {image}
                        </Badge>
                    ) : (
                        image
                    )}
                    <CardHeader
                        title={
                            highlightRanges ? (
                                <Highlight
                                    text={name}
                                    ranges={highlightRanges}
                                />
                            ) : (
                                name
                            )
                        }
                        subheader={filesize(size)}
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
                    {hasWarning && (
                        <Alert severity="warning">
                            The scene contains more than one of this unique
                            token. The persisted token will not update.
                        </Alert>
                    )}
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
                                onChange={(_, value: PersistenceType) => {
                                    if (value) {
                                        setType(key, value);
                                    }
                                }}
                            >
                                <ToggleButton
                                    title="Unique token (updates to the token are saved immediately)"
                                    value={"UNIQUE" satisfies PersistenceType}
                                >
                                    <Person fontSize="small" />
                                </ToggleButton>
                                <ToggleButton
                                    title="Template token (template must be updated manually)"
                                    value={"TEMPLATE" satisfies PersistenceType}
                                >
                                    <Group fontSize="small" />
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Control>
                        <Control label="Rename">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    const newName = prompt("New name:", name);
                                    if (newName) {
                                        if (newName.length < 50) {
                                            setName(key, newName);
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
                                        `Stop persisting token "${name}"?`,
                                    );
                                    if (ok) {
                                        removeToken(key);
                                    }
                                }}
                                aria-label="remove token"
                            >
                                <DeleteOutline fontSize="small" />
                            </IconButton>
                        </Control>
                    </Stack>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <Control label="Save attachments?">
                            <Switch
                                checked={token.restoreAttachments ?? true}
                                onChange={(_e, checked) =>
                                    setRestoreAttachments(key, checked)
                                }
                            />
                        </Control>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        Last modified{" "}
                        {formatTimestamp(persistedTokenGetLastModified(token))}
                    </Typography>
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
};
