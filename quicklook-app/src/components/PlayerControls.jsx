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
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import Replay5Icon from "@mui/icons-material/Replay5";
import { formatTimecode } from "../utils/sessionParser";

const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 4, 8];

export default function PlayerControls({
  duration,
  currentTime,
  onCurrentTimeChange,
  playing,
  onPlayingChange,
  playerRef,
  eventMarks = [],
  skipInactive = true,
  onSkipInactiveChange,
  onTogglePlay,
}) {
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    try {
      if (playerRef?.current?.setSpeed && speed) playerRef.current.setSpeed(speed);
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

  const marks = eventMarks.length > 0
    ? eventMarks.slice(0, 100).map((ms) => ({ value: ms }))
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
            sx={{ py: 0.5 }}
          />
        </Box>
      </Box>
    </Box>
  );
}
