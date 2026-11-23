import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import type { CliInstallResult, CliOpenPayload, CliStatus } from '../shared/cli'
import { SHOT_RENDERER_FLAG } from '../shared/shotMode'

const api = {
  platform: process.platform,

  // True only when main put SHOT_RENDERER_FLAG on this renderer's command line
  // (webPreferences.additionalArguments), which it does for `--shot` on an
  // unpackaged build. Gates the screenshot-automation bridge.
  shotMode: process.argv.includes(SHOT_RENDERER_FLAG),

  // Terminal scroll forensics: set GITHUTTBR_SCROLL_DEBUG=1 at launch and the
  // terminal scroll listener streams its decisions through push() into
  // userData/githuttbr-scroll-debug.log. Diagnostic only.
  scrollDebug: {
    enabled: process.env.GITHUTTBR_SCROLL_DEBUG === '1',
    push: (line: string): void => {
      ipcRenderer.send('scroll-debug', line)
    }
  },

  git: (method: string, ...args: unknown[]): Promise<unknown> => ipcRenderer.invoke('git', method, ...args),

  onCloneProgress: (cb: (p: unknown) => void): (() => void) => {
    const listener = (_e: unknown, p: unknown): void => cb(p)
    ipcRenderer.on('clone:progress', listener)
    return () => ipcRenderer.removeListener('clone:progress', listener)
  },

  onBisectOutput: (cb: (chunk: string) => void): (() => void) => {
    const listener = (_e: unknown, chunk: string): void => cb(chunk)
    ipcRenderer.on('bisect:output', listener)
    return () => ipcRenderer.removeListener('bisect:output', listener)
  },

  localci: {
    status: (): Promise<unknown> => ipcRenderer.invoke('localci:status'),
    workflows: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('localci:workflows', repoPath),
    run: (repoPath: string, workflowFile: string): Promise<unknown> =>
      ipcRenderer.invoke('localci:run', repoPath, workflowFile),
    cancel: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('localci:cancel', repoPath),
    record: (repoPath: string, workflowFile: string, ok: boolean): Promise<unknown> =>
      ipcRenderer.invoke('localci:record', repoPath, workflowFile, ok),
    verdicts: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('localci:verdicts', repoPath),
    runAt: (repoPath: string, workflowFile: string, sha: string): Promise<unknown> =>
      ipcRenderer.invoke('localci:runAt', repoPath, workflowFile, sha),
    resolveRange: (repoPath: string, spec: string, limit: number): Promise<unknown> =>
      ipcRenderer.invoke('localci:resolveRange', repoPath, spec, limit),
    sweep: (repoPath: string, workflowFile: string, shas: string[]): Promise<unknown> =>
      ipcRenderer.invoke('localci:sweep', repoPath, workflowFile, shas),
    onData: (cb: (p: { repoPath: string; chunk: string }) => void): (() => void) => {
      const listener = (_e: unknown, p: { repoPath: string; chunk: string }): void => cb(p)
      ipcRenderer.on('localci:data', listener)
      return () => ipcRenderer.removeListener('localci:data', listener)
    },
    onSweepProgress: (cb: (p: unknown) => void): (() => void) => {
      const listener = (_e: unknown, p: unknown): void => cb(p)
      ipcRenderer.on('localci:sweep-progress', listener)
      return () => ipcRenderer.removeListener('localci:sweep-progress', listener)
    }
  },

  // Resolve a dropped File to its absolute path (File.path was removed in Electron 32).
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  // OS keychain consent. `onAsk` fires when the main process is about to use
  // safeStorage for the first time and wants the user to see why.
  keychain: {
    onAsk: (cb: (payload: { reason: string; adopted: boolean }) => void): (() => void) => {
      const listener = (_e: unknown, payload: { reason: string; adopted: boolean }): void => cb(payload)
      ipcRenderer.on('keychain:ask', listener)
      return () => ipcRenderer.removeListener('keychain:ask', listener)
    },
    answer: (granted: boolean): Promise<void> => ipcRenderer.invoke('keychain:answer', granted),
    status: (): Promise<unknown> => ipcRenderer.invoke('keychain:status'),
    set: (granted: boolean): Promise<boolean> => ipcRenderer.invoke('keychain:set', granted),
    // The stored tokens were decrypted for the first time this session.
    onUnlocked: (cb: () => void): (() => void) => {
      const listener = (): void => cb()
      ipcRenderer.on('secrets:unlocked', listener)
      return () => ipcRenderer.removeListener('secrets:unlocked', listener)
    }
  },

  selectDirectory: (title?: string): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory', title),
  selectDirectories: (title?: string): Promise<string[]> => ipcRenderer.invoke('dialog:selectDirectories', title),
  savePatch: (defaultName: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:savePatch', defaultName, content),
  openPatch: (): Promise<{ path: string; content: string } | null> => ipcRenderer.invoke('dialog:openPatch'),
  choosePath: (
    title: string,
    defaultName: string,
    filters?: { name: string; extensions: string[] }[]
  ): Promise<string | null> => ipcRenderer.invoke('dialog:choosePath', title, defaultName, filters),
  openFilePath: (title: string, filters?: { name: string; extensions: string[] }[]): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFilePath', title, filters),
  saveBinary: (
    defaultName: string,
    data: Uint8Array,
    filters?: { name: string; extensions: string[] }[]
  ): Promise<string | null> => ipcRenderer.invoke('dialog:saveBinary', defaultName, data, filters),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  appReleases: (): Promise<unknown> => ipcRenderer.invoke('app:releases'),
  /** True once, on the first start after settings were copied from a pre-4.39 install. */
  takeMigrationNotice: (): Promise<boolean> => ipcRenderer.invoke('app:takeMigrationNotice'),

  shell: {
    showItemInFolder: (fullPath: string): Promise<void> => ipcRenderer.invoke('shell:showItemInFolder', fullPath),
    openPath: (fullPath: string): Promise<string> => ipcRenderer.invoke('shell:openPath', fullPath),
    openWithPicker: (fullPath: string): Promise<string> => ipcRenderer.invoke('shell:openWithPicker', fullPath),
    pickApplication: (): Promise<{ name: string; path: string } | null> =>
      ipcRenderer.invoke('shell:pickApplication'),
    openWithApp: (targetPath: string, appPath: string): Promise<string> =>
      ipcRenderer.invoke('shell:openWithApp', targetPath, appPath),
    writeFiles: (repoPath: string, files: unknown): Promise<void> =>
      ipcRenderer.invoke('shell:writeFiles', repoPath, files)
  },

  difftool: {
    config: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('difftool:config', repoPath),
    set: (repoPath: string, values: unknown, scope: string): Promise<void> =>
      ipcRenderer.invoke('difftool:set', repoPath, values, scope),
    diff: (repoPath: string, file: string, rev?: string, tool?: string): Promise<string> =>
      ipcRenderer.invoke('difftool:diff', repoPath, file, rev, tool),
    merge: (repoPath: string, file: string, tool?: string): Promise<string> =>
      ipcRenderer.invoke('difftool:merge', repoPath, file, tool)
  },

  ssh: {
    status: (): Promise<unknown> => ipcRenderer.invoke('ssh:status'),
    generate: (name: string, comment: string, passphrase: string): Promise<string> =>
      ipcRenderer.invoke('ssh:generate', name, comment, passphrase),
    addToAgent: (publicKeyPath: string, passphrase: string): Promise<string> =>
      ipcRenderer.invoke('ssh:addToAgent', publicKeyPath, passphrase),
    test: (host: string): Promise<unknown> => ipcRenderer.invoke('ssh:test', host)
  },

  editor: {
    detect: (): Promise<unknown> => ipcRenderer.invoke('editor:detect'),
    open: (setting: unknown, target: unknown): Promise<string> =>
      ipcRenderer.invoke('editor:open', setting, target)
  },

  settings: {
    get: (): Promise<unknown> => ipcRenderer.invoke('settings:get'),
    unlock: (): Promise<unknown> => ipcRenderer.invoke('settings:unlock'),
    set: (settings: unknown, generation?: number, options?: unknown): Promise<unknown> =>
      ipcRenderer.invoke('settings:set', settings, generation, options),
    moveAside: (): Promise<unknown> => ipcRenderer.invoke('settings:moveAside'),
    secretsState: (): Promise<unknown> => ipcRenderer.invoke('settings:secretsState'),
    replaceUnreadableStore: (): Promise<boolean> => ipcRenderer.invoke('settings:replaceUnreadableStore'),
    importFile: (): Promise<unknown> => ipcRenderer.invoke('settings:importFile'),
    exportFile: (settings: unknown): Promise<boolean> => ipcRenderer.invoke('settings:exportFile', settings)
  },

  ai: {
    commitMessage: (diff: string, cfg: unknown, ctx: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:commitMessage', diff, cfg, ctx),
    listModels: (cfg: unknown, force?: boolean): Promise<unknown> => ipcRenderer.invoke('ai:listModels', cfg, force),
    signInSubscription: (binary: string, path: string, requestId: string): Promise<unknown> =>
      ipcRenderer.invoke('ai:signInSubscription', binary, path, requestId),
    cancelSubscriptionSignIn: (requestId: string): Promise<void> =>
      ipcRenderer.invoke('ai:cancelSubscriptionSignIn', requestId),
    testSubscription: (binary: string, path: string): Promise<unknown> => ipcRenderer.invoke('ai:testSubscription', binary, path),
    detectCli: (): Promise<unknown> => ipcRenderer.invoke('ai:detectCli'),
    explainCode: (code: string, lang: string, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:explainCode', code, lang, cfg),
    editSelection: (req: unknown, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:editSelection', req, cfg),
    hoverExplain: (req: unknown, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:hoverExplain', req, cfg),
    resolveConflict: (file: string, content: string, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:resolveConflict', file, content, cfg),
    generateConfig: (repoName: string, artifacts: unknown, context: string, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:generateConfig', repoName, artifacts, context, cfg),
    suggestArtifacts: (repoName: string, selectedTools: unknown, context: string, alreadySelected: unknown, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:suggestArtifacts', repoName, selectedTools, context, alreadySelected, cfg),
    smartStage: (files: unknown, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:smartStage', files, cfg),
    generateAppTheme: (prompt: string, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:generateAppTheme', prompt, cfg),
    generateCodeTheme: (prompt: string, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:generateCodeTheme', prompt, cfg),
    generateGraphPalette: (prompt: string, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:generateGraphPalette', prompt, cfg),
    generateBranchName: (description: string, cfg: unknown, ctx: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:generateBranchName', description, cfg, ctx),
    reviewPR: (diff: string, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:reviewPR', diff, cfg),
    prDescription: (commits: string, diff: string, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:prDescription', commits, diff, cfg),
    planActions: (prompt: string, status: unknown, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:planActions', prompt, status, cfg),
    repoChat: (repoPath: string, messages: unknown, cfg: unknown, attachments: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:repoChat', repoPath, messages, cfg, attachments),
    repoChatFinalize: (repoPath: string, messages: unknown, result: unknown, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('ai:repoChatFinalize', repoPath, messages, result, cfg)
  },

  wiki: {
    facts: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('wiki:facts', repoPath),
    imports: (repoPath: string, depth: number): Promise<unknown> =>
      ipcRenderer.invoke('wiki:imports', repoPath, depth),
    get: (repoPath: string, model: string): Promise<unknown> => ipcRenderer.invoke('wiki:get', repoPath, model),
    generate: (repoPath: string, cfg: unknown): Promise<unknown> =>
      ipcRenderer.invoke('wiki:generate', repoPath, cfg),
    export: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('wiki:export', repoPath),
    clear: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('wiki:clear', repoPath),
    onProgress: (cb: (payload: unknown) => void): (() => void) => {
      const listener = (_e: unknown, payload: unknown): void => cb(payload)
      ipcRenderer.on('wiki:progress', listener)
      return () => ipcRenderer.removeListener('wiki:progress', listener)
    }
  },

  analytics: {
    get: (): Promise<unknown> => ipcRenderer.invoke('analytics:get'),
    clear: (): Promise<unknown> => ipcRenderer.invoke('analytics:clear'),
    setRetention: (days: number): Promise<unknown> => ipcRenderer.invoke('analytics:setRetention', days)
  },
  profileAvatar: {
    get: (id: string): Promise<unknown> => ipcRenderer.invoke('profileAvatar:get', id),
    pick: (id: string, title: string, filterName: string): Promise<unknown> =>
      ipcRenderer.invoke('profileAvatar:pick', id, title, filterName),
    remove: (id: string): Promise<unknown> => ipcRenderer.invoke('profileAvatar:remove', id),
    exportAll: (ids: string[]): Promise<unknown> => ipcRenderer.invoke('profileAvatar:exportAll', ids),
    importAll: (data: unknown): Promise<unknown> => ipcRenderer.invoke('profileAvatar:importAll', data)
  },
  avatars: {
    github: (remoteUrl: string, repoPath: string, items: unknown, size: number): Promise<unknown> =>
      ipcRenderer.invoke('avatars:github', remoteUrl, repoPath, items, size),
    profileGithub: (profileId: string, size: number): Promise<unknown> =>
      ipcRenderer.invoke('avatars:profileGithub', profileId, size)
  },
  vault: {
    list: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('vault:list', repoPath),
    upsert: (scope: string, repoPath: string, entry: unknown): Promise<unknown> =>
      ipcRenderer.invoke('vault:upsert', scope, repoPath, entry),
    remove: (scope: string, repoPath: string, id: string): Promise<unknown> =>
      ipcRenderer.invoke('vault:remove', scope, repoPath, id),
    exportAll: (): Promise<unknown> => ipcRenderer.invoke('vault:exportAll'),
    importAll: (data: unknown): Promise<unknown> => ipcRenderer.invoke('vault:importAll', data)
  },
  repos: {
    list: (): Promise<unknown> => ipcRenderer.invoke('repos:list'),
    remember: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('repos:remember', repoPath),
    forget: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('repos:forget', repoPath),
    scan: (rootList: unknown): Promise<unknown> => ipcRenderer.invoke('repos:scan', rootList),
    locate: (oldPath: string, newPath: string): Promise<unknown> =>
      ipcRenderer.invoke('repos:locate', oldPath, newPath),
    refresh: (paths: string[]): Promise<unknown> => ipcRenderer.invoke('repos:refresh', paths)
  },
  secureShare: {
    candidates: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('secure:candidates', repoPath),
    export: (repoPath: string, project: string, paths: string[], password: string): Promise<unknown> =>
      ipcRenderer.invoke('secure:export', repoPath, project, paths, password),
    pick: (): Promise<unknown> => ipcRenderer.invoke('secure:pick'),
    preview: (bundlePath: string, password: string, repoPath: string): Promise<unknown> =>
      ipcRenderer.invoke('secure:preview', bundlePath, password, repoPath),
    apply: (bundlePath: string, password: string, repoPath: string, selected: string[]): Promise<unknown> =>
      ipcRenderer.invoke('secure:apply', bundlePath, password, repoPath, selected),
    exportV2: (specs: unknown, project: string, password: string): Promise<unknown> =>
      ipcRenderer.invoke('secure:exportV2', specs, project, password),
    openV2: (bundlePath: string, password: string): Promise<unknown> =>
      ipcRenderer.invoke('secure:openV2', bundlePath, password),
    previewRepoV2: (
      bundlePath: string,
      password: string,
      sectionIndex: number,
      repoPath: string
    ): Promise<unknown> =>
      ipcRenderer.invoke('secure:previewRepoV2', bundlePath, password, sectionIndex, repoPath),
    applyV2: (bundlePath: string, password: string, plan: unknown): Promise<unknown> =>
      ipcRenderer.invoke('secure:applyV2', bundlePath, password, plan),
    previewNotesV2: (
      bundlePath: string,
      password: string,
      sectionIndex: number,
      repoPath: string
    ): Promise<unknown> =>
      ipcRenderer.invoke('secure:previewNotesV2', bundlePath, password, sectionIndex, repoPath)
  },
  info: {
    list: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('info:list', repoPath),
    upsert: (repoPath: string, entry: unknown): Promise<unknown> =>
      ipcRenderer.invoke('info:upsert', repoPath, entry),
    remove: (repoPath: string, id: string): Promise<unknown> =>
      ipcRenderer.invoke('info:remove', repoPath, id),
    reorder: (repoPath: string, ids: string[]): Promise<unknown> =>
      ipcRenderer.invoke('info:reorder', repoPath, ids),
    exportAll: (): Promise<unknown> => ipcRenderer.invoke('info:exportAll'),
    importAll: (data: unknown): Promise<unknown> => ipcRenderer.invoke('info:importAll', data)
  },

  env: {
    check: (): Promise<unknown> => ipcRenderer.invoke('env:check'),
    checkNetwork: (): Promise<unknown> => ipcRenderer.invoke('env:checkNetwork')
  },

  log: {
    get: (): Promise<unknown> => ipcRenderer.invoke('log:get'),
    clear: (): Promise<unknown> => ipcRenderer.invoke('log:clear')
  },

  hosting: {
    listRepos: (provider: string, token: string, org?: string, profileId?: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:listRepos', provider, token, org, profileId),
    listOwners: (provider: string, token: string, org?: string, profileId?: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:listOwners', provider, token, org, profileId),
    accountOwner: (provider: string, login: string, found: unknown, exceptProfileId: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:accountOwner', provider, login, found, exceptProfileId),
    whoAmI: (provider: string, token: string, org?: string, interactive?: boolean, link?: unknown, issuer?: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:whoAmI', provider, token, org, interactive, link, issuer),
    createRepo: (provider: string, token: string, opts: unknown, org?: string, profileId?: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:createRepo', provider, token, opts, org, profileId),
    listPRs: (repoPath: string, remoteUrl: string, tokens: unknown): Promise<unknown> =>
      ipcRenderer.invoke('hosting:listPRs', repoPath, remoteUrl, tokens),
    listReleases: (repoPath: string, remoteUrl: string, tokens: unknown): Promise<unknown> =>
      ipcRenderer.invoke('hosting:listReleases', repoPath, remoteUrl, tokens),
    ciStatuses: (repoPath: string, remoteUrl: string, shas: string[], token: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:ciStatuses', repoPath, remoteUrl, shas, token),
    canAct: (repoPath: string, remoteUrl: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:canAct', repoPath, remoteUrl),
    openCreatePR: (remoteUrl: string, source: string, target: string): Promise<boolean> =>
      ipcRenderer.invoke('hosting:openCreatePR', remoteUrl, source, target),
    createPR: (repoPath: string, remoteUrl: string, tokens: unknown, opts: unknown): Promise<unknown> =>
      ipcRenderer.invoke('hosting:createPR', repoPath, remoteUrl, tokens, opts),
    prPickerOptions: (repoPath: string, remoteUrl: string, tokens: unknown): Promise<unknown> =>
      ipcRenderer.invoke('hosting:prPickerOptions', repoPath, remoteUrl, tokens),
    prDetail: (repoPath: string, remoteUrl: string, tokens: unknown, number: number): Promise<unknown> =>
      ipcRenderer.invoke('hosting:prDetail', repoPath, remoteUrl, tokens, number),
    workItem: (repoPath: string, remoteUrl: string, tokens: unknown, id: number): Promise<unknown> =>
      ipcRenderer.invoke('hosting:workItem', repoPath, remoteUrl, tokens, id),
    prComment: (repoPath: string, remoteUrl: string, tokens: unknown, number: number, body: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:prComment', repoPath, remoteUrl, tokens, number, body),
    prReplyReviewComment: (
      repoPath: string,
      remoteUrl: string,
      tokens: unknown,
      number: number,
      inReplyTo: number | string,
      body: string
    ): Promise<unknown> =>
      ipcRenderer.invoke('hosting:prReplyReviewComment', repoPath, remoteUrl, tokens, number, inReplyTo, body),
    prCheckLog: (repoPath: string, remoteUrl: string, tokens: unknown, url: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:prCheckLog', repoPath, remoteUrl, tokens, url),
    prChecks: (repoPath: string, remoteUrl: string, tokens: unknown, number: number): Promise<unknown> =>
      ipcRenderer.invoke('hosting:prChecks', repoPath, remoteUrl, tokens, number),
    prFiles: (repoPath: string, remoteUrl: string, tokens: unknown, number: number): Promise<unknown> =>
      ipcRenderer.invoke('hosting:prFiles', repoPath, remoteUrl, tokens, number),
    prReview: (
      repoPath: string,
      remoteUrl: string,
      tokens: unknown,
      number: number,
      event: string,
      body: string
    ): Promise<unknown> =>
      ipcRenderer.invoke('hosting:prReview', repoPath, remoteUrl, tokens, number, event, body),
    prMerge: (repoPath: string, remoteUrl: string, tokens: unknown, number: number, method: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:prMerge', repoPath, remoteUrl, tokens, number, method),
    listNotifications: (token: string, all?: boolean): Promise<unknown> =>
      ipcRenderer.invoke('hosting:listNotifications', token, all),
    markNotificationRead: (token: string, id: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:markNotificationRead', token, id),
    markAllNotificationsRead: (token: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:markAllNotificationsRead', token),
    listIssues: (repoPath: string, remoteUrl: string, tokens: unknown): Promise<unknown> =>
      ipcRenderer.invoke('hosting:listIssues', repoPath, remoteUrl, tokens),
    uploadSshKey: (token: string, title: string, publicKey: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:uploadSshKey', token, title, publicKey),
    issueDetail: (repoPath: string, remoteUrl: string, tokens: unknown, number: number): Promise<unknown> =>
      ipcRenderer.invoke('hosting:issueDetail', repoPath, remoteUrl, tokens, number),
    setIssueState: (repoPath: string, remoteUrl: string, tokens: unknown, number: number, state: string): Promise<unknown> =>
      ipcRenderer.invoke('hosting:setIssueState', repoPath, remoteUrl, tokens, number, state),
    createIssue: (repoPath: string, remoteUrl: string, tokens: unknown, opts: unknown): Promise<unknown> =>
      ipcRenderer.invoke('hosting:createIssue', repoPath, remoteUrl, tokens, opts),
    updatePR: (repoPath: string, remoteUrl: string, tokens: unknown, number: number, patch: unknown): Promise<unknown> =>
      ipcRenderer.invoke('hosting:updatePR', repoPath, remoteUrl, tokens, number, patch),
    mergedPrHeads: (repoPath: string, remoteUrl: string, tokens: unknown, branches: string[]): Promise<unknown> =>
      ipcRenderer.invoke('hosting:mergedPrHeads', repoPath, remoteUrl, tokens, branches),
    ensureStack: (repoPath: string, remoteUrl: string, tokens: unknown, numbers: number[]): Promise<unknown> =>
      ipcRenderer.invoke('hosting:ensureStack', repoPath, remoteUrl, tokens, numbers),
    listMilestones: (repoPath: string, remoteUrl: string, tokens: unknown): Promise<unknown> =>
      ipcRenderer.invoke('hosting:listMilestones', repoPath, remoteUrl, tokens),
    milestoneIssues: (repoPath: string, remoteUrl: string, tokens: unknown, number: number): Promise<unknown> =>
      ipcRenderer.invoke('hosting:milestoneIssues', repoPath, remoteUrl, tokens, number)
  },

  term: {
    create: (cwd: string, cols: number, rows: number, shell?: string, poshTheme?: string): Promise<number> =>
      ipcRenderer.invoke('term:create', cwd, cols, rows, shell, poshTheme),
    input: (id: number, data: string): void => ipcRenderer.send('term:input', id, data),
    resize: (id: number, cols: number, rows: number): void => ipcRenderer.send('term:resize', id, cols, rows),
    kill: (id: number): void => ipcRenderer.send('term:kill', id),
    procName: (id: number): Promise<string> => ipcRenderer.invoke('term:process', id),
    completions: (id: number, kind: string): Promise<unknown> => ipcRenderer.invoke('term:completions', id, kind),
    poshThemes: (): Promise<{ dir: string | null; exe: string | null; themes: string[] }> =>
      ipcRenderer.invoke('term:posh-themes'),
    poshPreview: (theme: string): Promise<string | null> => ipcRenderer.invoke('term:posh-preview', theme),
    onData: (id: number, cb: (data: string) => void): (() => void) => {
      const listener = (_e: unknown, data: string): void => cb(data)
      ipcRenderer.on(`term:data:${id}`, listener)
      return () => ipcRenderer.removeListener(`term:data:${id}`, listener)
    },
    onExit: (id: number, cb: () => void): (() => void) => {
      const listener = (): void => cb()
      ipcRenderer.on(`term:exit:${id}`, listener)
      return () => ipcRenderer.removeListener(`term:exit:${id}`, listener)
    }
  },

  launch: {
    resolveInputs: (dir: string, inputs: import('../shared/types').LaunchInput[]): Promise<import('../shared/types').LaunchInputResolution> =>
      ipcRenderer.invoke('launch:resolveInputs', dir, inputs),
    discover: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('launch:discover', repoPath),
    run: (payload: unknown): Promise<{ id: number } | { error: string }> =>
      ipcRenderer.invoke('launch:run', payload),
    runTasks: (payload: unknown): Promise<{ id: number } | { error: string }> =>
      ipcRenderer.invoke('launch:runTasks', payload),
    /** Tell main the terminal is listening, so it can replay early output. */
    attach: (id: number): void => ipcRenderer.send('launch:attach', id),
    input: (id: number, data: string): void => ipcRenderer.send('launch:input', id, data),
    resize: (id: number, cols: number, rows: number): void =>
      ipcRenderer.send('launch:resize', id, cols, rows),
    signal: (id: number, action: 'pause' | 'resume'): void => ipcRenderer.send('launch:signal', id, action),
    stop: (id: number): void => ipcRenderer.send('launch:stop', id),
    onData: (id: number, cb: (data: string) => void): (() => void) => {
      const listener = (_e: unknown, data: string): void => cb(data)
      ipcRenderer.on(`launch:data:${id}`, listener)
      return () => ipcRenderer.removeListener(`launch:data:${id}`, listener)
    },
    /** The dev-tool address a session announces (and re-announces), with the
     *  name of whatever announced it. */
    onDevTools: (id: number, cb: (found: { url: string; name: string }) => void): (() => void) => {
      const listener = (_e: unknown, found: { url: string; name: string }): void => cb(found)
      ipcRenderer.on(`launch:devtools:${id}`, listener)
      return () => ipcRenderer.removeListener(`launch:devtools:${id}`, listener)
    },
    onExit: (id: number, cb: (code: number) => void): (() => void) => {
      const listener = (_e: unknown, code: number): void => cb(code)
      ipcRenderer.on(`launch:exit:${id}`, listener)
      return () => ipcRenderer.removeListener(`launch:exit:${id}`, listener)
    }
  },

  // Problems: the project's own analyzers, run on demand.
  analyze: {
    run: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('analyze:run', repoPath),
    detect: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('analyze:detect', repoPath),
    cancel: (repoPath: string): void => ipcRenderer.send('analyze:cancel', repoPath)
  },
  // Tests: the project's own suite (vitest / jest), run on demand.
  tests: {
    run: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('tests:run', repoPath),
    detect: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('tests:detect', repoPath),
    cancel: (repoPath: string): void => ipcRenderer.send('tests:cancel', repoPath)
  },

  // TODO markers carried by the repository's own source, scanned on demand.
  todoScan: {
    run: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('todoscan:run', repoPath),
    cancel: (repoPath: string): void => ipcRenderer.send('todoscan:cancel', repoPath)
  },

  // Run targets for a launch config: phones, simulators, emulators, desktops.
  devices: {
    list: (repoPath: string): Promise<unknown> => ipcRenderer.invoke('devices:list', repoPath),
    boot: (device: unknown): Promise<unknown> => ipcRenderer.invoke('devices:boot', device)
  },

  // The native application menu: the renderer describes it (translated, with
  // the right items enabled) and gets clicks back as command ids.
  menu: {
    set: (spec: unknown): Promise<void> => ipcRenderer.invoke('menu:set', spec),
    onCommand: (cb: (id: string) => void): (() => void) => {
      const listener = (_e: unknown, id: string): void => cb(id)
      ipcRenderer.on('menu:command', listener)
      return () => ipcRenderer.removeListener('menu:command', listener)
    }
  },

  window: {
    reportUiCrash: (message: string): void => ipcRenderer.send('window:ui-crashed', message),
    minimize: (): void => ipcRenderer.send('window:minimize'),
    maximize: (): void => ipcRenderer.send('window:maximize'),
    close: (): void => ipcRenderer.send('window:close')
  },

  zoom: {
    get: (): number => webFrame.getZoomFactor(),
    set: (factor: number): void => webFrame.setZoomFactor(factor)
  },

  watch: {
    repo: (path: string | null): Promise<void> => ipcRenderer.invoke('watch:repo', path),
    mute: (path: string, ms: number): Promise<void> => ipcRenderer.invoke('watch:mute', path, ms),
    onChange: (cb: (payload: { path: string; light: boolean }) => void): (() => void) => {
      const listener = (_e: unknown, payload: { path: string; light: boolean }): void => cb(payload)
      ipcRenderer.on('repo:changed', listener)
      return () => ipcRenderer.removeListener('repo:changed', listener)
    }
  },

  updates: {
    getState: (): Promise<unknown> => ipcRenderer.invoke('update:getState'),
    check: (silent?: boolean): Promise<void> => ipcRenderer.invoke('update:check', silent),
    download: (): Promise<void> => ipcRenderer.invoke('update:download'),
    install: (): void => ipcRenderer.send('update:install'),
    onEvent: (cb: (state: unknown) => void): (() => void) => {
      const listener = (_e: unknown, state: unknown): void => cb(state)
      ipcRenderer.on('update:event', listener)
      return () => ipcRenderer.removeListener('update:event', listener)
    }
  },

  cli: {
    isInstalled: (): Promise<boolean> => ipcRenderer.invoke('cli:isInstalled'),
    install: (): Promise<CliInstallResult> => ipcRenderer.invoke('cli:install'),
    uninstall: (): Promise<CliInstallResult> => ipcRenderer.invoke('cli:uninstall'),
    status: (): Promise<CliStatus> => ipcRenderer.invoke('cli:status'),
    removeStale: (): Promise<CliInstallResult> => ipcRenderer.invoke('cli:removeStale'),
    // Fired when `githuttbr <dir>` asks this window to open a folder — on cold
    // launch (main sends it once the page finishes loading) or when a second
    // `githuttbr` invocation hands off to this already-running instance.
    onOpenPath: (cb: (payload: CliOpenPayload) => void): (() => void) => {
      const listener = (_e: unknown, payload: CliOpenPayload): void => cb(payload)
      ipcRenderer.on('cli:open-path', listener)
      return () => ipcRenderer.removeListener('cli:open-path', listener)
    },
    // `githuttbr --wait <file>` — git is blocked until finishEdit is called, so
    // every path out of the editor surface must call it exactly once.
    onEdit: (cb: (req: { file: string; sentinel: string; content: string }) => void): (() => void) => {
      const listener = (_e: unknown, req: { file: string; sentinel: string; content: string }): void => cb(req)
      ipcRenderer.on('cli:edit', listener)
      return () => ipcRenderer.removeListener('cli:edit', listener)
    },
    finishEdit: (sentinel: string, content: string | null): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('cli:finishEdit', sentinel, content)
  }
}

export type PreloadApi = typeof api

contextBridge.exposeInMainWorld('api', api)
