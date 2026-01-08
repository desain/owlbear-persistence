import {
    Attachment,
    Description,
    ExpandMore,
    Group,
    Layers,
    Person,
    TextFields,
    Warning,
} from "@mui/icons-material";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import Edit from "@mui/icons-material/Edit";
import {
    Accordion,
    AccordionActions,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Badge,
    Box,
    Button,
    CardHeader,
    CardMedia,
    Stack,
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
    invertPersistedProperties,
    persistedTokenFull,
    persistedTokenGetLastModified,
    persistedTokenGetName,
    persistedTokenKey,
    type PersistedProperty,
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
    const setDisabledProperties = usePlayerStorage(
        (s) => s.setTokenDisabledProperties,
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
                <Stack
                    direction="row"
                    alignItems="center"
                    sx={{ width: "100%" }}
                >
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
                    <Box sx={{ flexGrow: 1 }} />
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
                        flexWrap="wrap"
                        rowGap={2}
                    >
                        <Control label="Persistence Type">
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
                                    unique
                                </ToggleButton>
                                <ToggleButton
                                    title="Template token (template must be updated manually)"
                                    value={"TEMPLATE" satisfies PersistenceType}
                                >
                                    <Group fontSize="small" />
                                    template
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Control>
                        {persistedTokenFull(token) && (
                            <Control label="Persisted properties">
                                <ToggleButtonGroup
                                    value={invertPersistedProperties(
                                        token.disabledProperties,
                                    )}
                                    onChange={(
                                        _e,
                                        allowProps: PersistedProperty[],
                                    ) =>
                                        setDisabledProperties(
                                            key,
                                            invertPersistedProperties(
                                                allowProps,
                                            ),
                                        )
                                    }
                                >
                                    <ToggleButton
                                        title="Attachments"
                                        value={
                                            "ATTACHMENTS" satisfies PersistedProperty
                                        }
                                    >
                                        <Attachment />
                                    </ToggleButton>
                                    <ToggleButton
                                        title="Text"
                                        value={
                                            "TEXT" satisfies PersistedProperty
                                        }
                                    >
                                        <TextFields />
                                    </ToggleButton>
                                    <ToggleButton
                                        title="Description"
                                        value={
                                            "DESCRIPTION" satisfies PersistedProperty
                                        }
                                    >
                                        <Description />
                                    </ToggleButton>
                                    <ToggleButton
                                        title="Layer"
                                        value={
                                            "LAYER" satisfies PersistedProperty
                                        }
                                    >
                                        <Layers />
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            </Control>
                        )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        Last modified{" "}
                        {formatTimestamp(persistedTokenGetLastModified(token))}
                    </Typography>
                </Stack>
            </AccordionDetails>
            <AccordionActions>
                <Button
                    size="small"
                    startIcon={<Edit />}
                    onClick={(e) => {
                        e.stopPropagation();
                        const newName = prompt("New name:", name);
                        if (newName) {
                            if (newName.length < 50) {
                                setName(key, newName);
                            }
                        }
                    }}
                >
                    Rename
                </Button>

                <Button
                    size="small"
                    startIcon={<DeleteOutline />}
                    onClick={(e) => {
                        e.stopPropagation();
                        const ok = window.confirm(
                            `Stop persisting token "${name}"?`,
                        );
                        if (ok) {
                            removeToken(key);
                        }
                    }}
                >
                    Delete
                </Button>
            </AccordionActions>
        </Accordion>
    );
};
