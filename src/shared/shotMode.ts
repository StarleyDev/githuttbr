/**
 * The switch main adds to the renderer's command line (via
 * webPreferences.additionalArguments) when screenshot mode is on. Its own name,
 * not `--shot`, so the preload's check means "main decided", never "someone
 * typed a flag".
 */
export const SHOT_RENDERER_FLAG = '--githuttbr-shot-bridge'
