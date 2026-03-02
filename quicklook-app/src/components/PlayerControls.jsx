import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  IconButton,
  Slider,
  FormControl,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Tooltip,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import Replay5Icon from "@mui/icons-material/Replay5";
import { formatTimecode } from "../utils/sessionParser";

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 4, 8];

const MARK_COLORS = {
  url: "#2196f3",
  click: "#4caf50",
  input: "#ff9800",
  custom: "#9c27b0",
};

const MARK_TYPE_LABELS = {
  url: "URL change",
  click: "Click",
  input: "Input",
  custom: "Custom event",
};

function TimelineMark(props) {
  const { typeByIndex, labelByIndex, ...rest } = props;
  const index = rest["data-index"];
  const type = typeByIndex?.[index] || "custom";
  const color = MARK_COLORS[type] ?? MARK_COLORS.custom;
  const tooltipTitle = labelByIndex?.[index] ?? (MARK_TYPE_LABELS[type] ?? "Event");
  const content = (
    <span
      {...rest}
      data-mark-type={type}
      style={{
        ...rest.style,
        position: "absolute",
        top: "50%",
        width: 6,
        height: 6,
        borderRadius: "50%",
        backgroundColor: color,
        boxShadow: `0 0 4px ${color}40`,
        transform: "translate(-50%, -50%)",
        opacity: rest.markActive ? 1 : 0.85,
        transition: "all 0.2s ease",
      }}
    />
  );
  return (
    <Tooltip title={tooltipTitle} placement="top" arrow enterDelay={300} leaveDelay={0}>
      {content}
    </Tooltip>
  );
}

export default function PlayerControls({
  duration,
  currentTime,
  onCurrentTimeChange,
  playing,
  onPlayingChange,
  playerRef,
  eventMarks = [],
  eventMarksWithTypes = [],
  skipInactive = true,
  onSkipInactiveChange,
  onTogglePlay,
}) {
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    try {
      if (playerRef?.current?.setSpeed != null && typeof speed === "number") {
        playerRef.current.setSpeed(speed);
      }
    } catch (_) {}
  }, [speed, playerRef]);

  const getReplayer = () => {
    try {
      return playerRef?.current?.getReplayer?.();
    } catch (_) {
      return null;
    }
  };

  const handleSeek = (_, value) => {
    const ms = typeof value === "number" ? value : value[0];
    onCurrentTimeChange(ms);
    onPlayingChange?.(false);
    try {
      const wrapper = playerRef?.current;
      if (wrapper?.goto) wrapper.goto(ms, false);
    } catch (e) {}
  };
  const handleBack5 = () => {
    const t = Math.max(0, currentTime - 5000);
    onCurrentTimeChange(t);
    onPlayingChange?.(false);
    try {
      const wrapper = playerRef?.current;
      if (wrapper?.goto) wrapper.goto(t, false);
    } catch (e) {}
  };
  const togglePlay = () => {
    if (onTogglePlay) {
      onTogglePlay();
      return;
    }
    try {
      const wrapper = playerRef?.current;
      if (wrapper) {
        if (playing) wrapper.pause?.();
        else wrapper.play?.();
      }
      onPlayingChange(!playing);
    } catch (e) {}
  };
  const handleSkipInactiveToggle = (e) => {
    const checked = e.target.checked;
    try {
      const replayer = getReplayer();
      if (replayer && typeof replayer.setConfig === "function") {
        replayer.setConfig({ skipInactive: checked });
      }
      if (playerRef?.current?.toggleSkipInactive) playerRef.current.toggleSkipInactive();
    } catch (_) {}
    onSkipInactiveChange?.(checked);
  };

  const useTypedMarks = eventMarksWithTypes.length > 0;
  const marks = useTypedMarks
    ? eventMarksWithTypes.slice(0, 100).map((m) => ({ value: m.timeMs }))
    : eventMarks.length > 0
      ? eventMarks.slice(0, 100).map((ms) => ({ value: ms }))
      : [];
  const markTypeByIndex = useTypedMarks ? eventMarksWithTypes.slice(0, 100).map((m) => m.type) : [];
  const markLabelsByIndex = useTypedMarks
    ? eventMarksWithTypes.slice(0, 100).map(
        (m) => `${MARK_TYPE_LABELS[m.type] ?? "Event"} · ${formatTimecode(m.timeMs)}`
      )
    : [];

  return (
    <Box
      sx={{
        mt: 1.5,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        boxShadow: (theme) => (theme.palette.mode === "dark" ? "0 -2px 10px rgba(0,0,0,0.2)" : "0 -1px 4px rgba(0,0,0,0.06)"),
      }}
    >
      {/* Main row: Play/Pause, time, skip 5s, speed, timeline */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1,
          flexWrap: "wrap",
        }}
      >
        <IconButton size="small" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} color="primary">
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <Typography variant="body2" sx={{ minWidth: 88, fontSize: "0.8125rem" }}>
          {formatTimecode(currentTime)} / {formatTimecode(duration)}
        </Typography>
        <IconButton size="small" onClick={handleBack5} aria-label="Back 5s">
          <Replay5Icon />
        </IconButton>
        <FormControl size="small" sx={{ minWidth: 64 }}>
          <Select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            variant="outlined"
            sx={{ height: 30, fontSize: "0.8125rem" }}
          >
            {SPEED_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {s}x
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Play at real speed; idle periods longer than 30s are skipped automatically.">
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={skipInactive}
                onChange={handleSkipInactiveToggle}
                color="primary"
              />
            }
            label={<Typography variant="caption" sx={{ fontSize: "0.75rem" }}>Skip inactivity</Typography>}
          />
        </Tooltip>
        <Box sx={{ flex: 1, minWidth: 120, mx: 1 }}>
          <Slider
            size="small"
            value={Math.min(currentTime, duration || 1)}
            min={0}
            max={duration || 1}
            step={100}
            onChange={handleSeek}
            marks={marks}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => formatTimecode(v)}
            slots={{ mark: useTypedMarks ? TimelineMark : undefined }}
            slotProps={{
              mark: useTypedMarks ? { typeByIndex: markTypeByIndex, labelByIndex: markLabelsByIndex } : undefined,
            }}
            sx={{
              py: 0.5,
              "& .MuiSlider-mark": useTypedMarks
                ? undefined
                : { width: 6, height: 6, borderRadius: "50%", marginLeft: -3 },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
