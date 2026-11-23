// Side-effect module: imported first by every main-process entry, so the
// environment is repaired before any other module's top level can spawn a
// child. ES imports evaluate in order, which is the whole mechanism — keep the
// import at the top. See searchPathEnv.ts for what is removed and why.
// Silent on purpose: it runs before guardStdio, so it must not write to stdio.
import { sanitizeSearchPathEnv } from './searchPathEnv'

sanitizeSearchPathEnv(process.env)
