import { renderTimeViewClock } from "@mui/x-date-pickers/timeViewRenderers";

export const CLOCK_VIEW_RENDERERS = {
  hours: renderTimeViewClock,
  minutes: renderTimeViewClock,
  seconds: renderTimeViewClock,
} as const;

