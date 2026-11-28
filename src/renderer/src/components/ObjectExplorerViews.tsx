import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  Binary,
  Check,
  ChevronRight,
  Copy,
  File,
  Folder,
  GitCommitHorizontal,
  GitCommitVertical,
  Tag
} from 'lucide-react'
import type { GitObject, GitObjectKind, TreeChild } from '../../../shared/types'
import { useT, useUiLanguage, interp, type TranslationKey } from '../i18n'
import { useUIStore } from '../stores/ui'
import { interpNodes } from './ConflictWorkspace'
import { formatBytes } from '../lib/fileSize'
import { formatIdentDate, isSameIdent, parseGitIdent, type GitIdent } from '../lib/gitIdent'
import { getModeMeaning, sortTreeEntries, type ModeMeaning, type StepLink, type TrailStep } from '../lib/objectTrail'

type Translate = (key: TranslationKey) => string

const KIND_LABEL: Record<GitObjectKind, TranslationKey> = {
  commit: 'objects.kindCommit',
  tree: 'objects.kindTree',
  blob: 'objects.kindBlob',
  tag: 'objects.kindTag'
}

/** `tree f6a202f` — the kind as git names it, then the short sha. */
const KIND_CHIP: Record<GitObjectKind, TranslationKey> = {
  commit: 'objects.chipCommit',
  tree: 'objects.chipTree',
  blob: 'objects.chipBlob',
  tag: 'objects.chipTag'
}

const MODE_LABEL: Record<ModeMeaning, TranslationKey> = {
  file: 'objects.modeFile',
  executable: 'objects.modeExecutable',
  folder: 'objects.modeFolder',
  symlink: 'objects.modeSymlink',
  submodule: 'objects.modeSubmodule',
  unknown: 'objects.modeUnknown'
}

/** The longer wording a blob's "named …" line uses; the table's chip is the short one. */
const MODE_LONG: Partial<Record<ModeMeaning, TranslationKey>> = {
  file: 'objects.modeLongFile',
  executable: 'objects.modeLongExecutable',
  symlink: 'objects.modeLongSymlink'
}

/** The model strip, in the order git builds it. A tag cell appears only on a tag. */
const MODEL: { id: 'ref' | GitObjectKind; hintKey: TranslationKey }[] = [
  { id: 'ref', hintKey: 'objects.modelRef' },
  { id: 'tag', hintKey: 'objects.modelTag' },
  { id: 'commit', hintKey: 'objects.modelCommit' },
  { id: 'tree', hintKey: 'objects.modelTree' },
  { id: 'blob', hintKey: 'objects.modelBlob' }
]

function KindGlyph({ kind, size }: { kind: GitObjectKind; size: number }): React.JSX.Element {
  if (kind === 'tree') return <Folder size={size} aria-hidden="true" />
  if (kind === 'blob') return <File size={size} aria-hidden="true" />
  if (kind === 'tag') return <Tag size={size} aria-hidden="true" />
  return <GitCommitHorizontal size={size} aria-hidden="true" />
}

function itemCount(n: number, t: Translate): string {
  return n === 1 ? t('objects.itemsOne') : interp(t('objects.items'), { n })
}

/** The commit a blob or tree was reached through, short when it is a sha. */
function shortCommit(commit: string): string {
  return /^[0-9a-f]{40,64}$/i.test(commit) ? commit.slice(0, 7) : commit
}

function CopySha({ sha }: { sha: string }): React.JSX.Element {
  const t = useT()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <button
      className="obj-copy"
      onClick={() => {
        void navigator.clipboard.writeText(sha).then(() => setCopied(true))
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? t('objects.copied') : t('objects.copy')}
    </button>
  )
}

/** One sentence of what this kind of object is, with the kinds it mentions in their colours. */
function Explanation({ object, step }: { object: GitObject; step: TrailStep }): React.JSX.Element {
  const t = useT()
  const word = (key: TranslationKey, kind?: GitObjectKind): ReactNode => (
    <b className={kind ? `obj-word kind-${kind}` : 'obj-word'}>{t(key)}</b>
  )
  let text: ReactNode[]
  if (object.kind === 'commit') {
    text = interpNodes(t('objects.explainCommit'), {
      commit: word('objects.wCommit', 'commit'),
      tree: word('objects.wOneTree', 'tree'),
      parents: word('objects.wParents', 'commit')
    })
  } else if (object.kind === 'tree') {
    text = interpNodes(t('objects.explainTree'), {
      tree: word('objects.wTree', 'tree'),
      name: word('objects.wName'),
      mode: word('objects.wMode'),
      blobs: word('objects.wBlobs', 'blob')
    })
  } else if (object.kind === 'blob' && step.name) {
    const parent = step.path?.includes('/') ? `${step.path.split('/').slice(-2, -1)[0]}/` : t('objects.root')
    text = interpNodes(t('objects.explainBlobNamed'), {
      blob: word('objects.wBlob', 'blob'),
      name: <b className="obj-word">{step.name}</b>,
      tree: <b className="obj-word kind-tree">{parent}</b>
    })
  } else if (object.kind === 'blob') {
    text = interpNodes(t('objects.explainBlob'), { blob: word('objects.wBlob', 'blob') })
  } else {
    text = interpNodes(t('objects.explainTag'), {
      tag: word('objects.wTag', 'tag'),
      target: word('objects.wTarget', 'commit')
    })
  }
  return <p className="obj-explain">{text}</p>
}

function ObjectHeader({ object, step }: { object: GitObject; step: TrailStep }): React.JSX.Element {
  const t = useT()
  const title =
    object.kind === 'commit'
      ? (object.commit?.message.split('\n')[0] ?? '')
      : object.kind === 'tag'
        ? (object.tag?.name ?? '')
        : step.root
          ? t('objects.rootTree')
          : step.name
            ? object.kind === 'tree'
              ? `${step.path ?? step.name}/`
              : step.name
            : object.sha.slice(0, 7)
  const size =
    object.kind === 'tree'
      ? itemCount(object.tree?.length ?? 0, t)
      : object.kind === 'blob'
        ? interp(t(object.blob?.text === null ? 'objects.blobBinary' : 'objects.blobText'), {
            size: formatBytes(object.size)
          })
        : formatBytes(object.size)
  return (
    <div className="obj-head">
      <div className="obj-head-line">
        <span className={`obj-badge kind-${object.kind}`}>
          <KindGlyph kind={object.kind} size={12} />
          {t(KIND_LABEL[object.kind])}
        </span>
        <h4 className={object.kind === 'tree' || object.kind === 'blob' ? 'obj-mono' : ''}>{title}</h4>
      </div>
      <div className="obj-head-meta">
        <code>{object.sha}</code>
        <CopySha sha={object.sha} />
        <span>{size}</span>
      </div>
      <Explanation object={object} step={step} />
    </div>
  )
}

/** A card that opens the object it names: the commit's tree, a parent, a tag's target. */
function PointerCard(props: {
  kind: GitObjectKind
  parentIcon?: boolean
  title: ReactNode
  hint: string
  sha: string
  onOpen: () => void
}): React.JSX.Element {
  const t = useT()
  return (
    <button className="obj-card obj-pointer" onClick={props.onOpen}>
      <span className={`obj-pointer-icon kind-${props.kind}`} aria-hidden="true">
        {props.parentIcon ? <GitCommitVertical size={17} /> : <KindGlyph kind={props.kind} size={17} />}
      </span>
      <span className="obj-pointer-body">
        <span className="obj-pointer-title">{props.title}</span>
        <span className="obj-pointer-hint">{props.hint}</span>
        <code className={`kind-${props.kind}`}>
          {interp(t(KIND_CHIP[props.kind]), { sha: props.sha.slice(0, 7), name: props.sha.slice(0, 7) })}
        </code>
      </span>
      <ChevronRight size={16} className="obj-pointer-go obj-flip" aria-hidden="true" />
    </button>
  )
}

function IdentCard({ labelKey, ident, raw, same }: {
  labelKey: TranslationKey
  ident: GitIdent | null
  raw: string
  same?: boolean
}): React.JSX.Element {
  const t = useT()
  const lang = useUiLanguage()
  const when = ident ? formatIdentDate(ident, lang) : null
  return (
    <div className="obj-card obj-ident">
      <span className="obj-section-label">{t(labelKey)}</span>
      {same ? (
        <span className="obj-ident-who">{t('objects.sameAsAuthor')}</span>
      ) : ident ? (
        <span className="obj-ident-who">
          {ident.name} <span className="obj-dim">{`<${ident.email}>`}</span>
        </span>
      ) : (
        <span className="obj-ident-who">{raw}</span>
      )}
      {when && (
        <span className="obj-ident-when" title={`${ident?.epoch} ${ident?.tz}`}>
          {interp(t('objects.identDate'), when)}
        </span>
      )}
    </div>
  )
}

function CommitView({ object, onFollow }: { object: GitObject; onFollow: (sha: string, link: StepLink) => void }): React.JSX.Element | null {
  const t = useT()
  const commit = object.commit
  if (!commit) return null
  const author = parseGitIdent(commit.author)
  const committer = parseGitIdent(commit.committer)
  return (
    <>
      <section className="obj-section">
        <h5 className="obj-section-label">{t('objects.pointsTo')}</h5>
        <div className="obj-grid">
          <PointerCard
            kind="tree"
            title={
              <>
                {t('objects.rootTree')} <span className="obj-dim obj-light">· {itemCount(commit.treeCount, t)}</span>
              </>
            }
            hint={t('objects.rootTreeHint')}
            sha={commit.tree}
            onOpen={() => onFollow(commit.tree, { via: 'tree' })}
          />
          {commit.parents.map((parent, i) => (
            <PointerCard
              key={parent}
              kind="commit"
              parentIcon
              title={commit.parents.length > 1 ? interp(t('objects.parentCommitN'), { n: i + 1 }) : t('objects.parentCommit')}
              hint={commit.parentSubjects[i] ?? ''}
              sha={parent}
              onOpen={() => onFollow(parent, { via: 'parent' })}
            />
          ))}
          {commit.parents.length === 0 && (
            <div className="obj-card obj-pointer obj-pointer-none">
              <span className="obj-pointer-hint">{t('objects.noParents')}</span>
            </div>
          )}
        </div>
      </section>

      <div className="obj-grid">
        <IdentCard labelKey="objects.author" ident={author} raw={commit.author} />
        <IdentCard labelKey="objects.committer" ident={committer} raw={commit.committer} same={isSameIdent(author, committer)} />
      </div>

      <section className="obj-section">
        <h5 className="obj-section-label">{t('objects.message')}</h5>
        <pre className="obj-card obj-message">{commit.message.trimEnd()}</pre>
      </section>
    </>
  )
}

function TagView({ object, onFollow }: { object: GitObject; onFollow: (sha: string, link: StepLink) => void }): React.JSX.Element | null {
  const t = useT()
  const tag = object.tag
  if (!tag) return null
  const kind = (['commit', 'tree', 'blob', 'tag'].includes(tag.type) ? tag.type : 'commit') as GitObjectKind
  return (
    <>
      <section className="obj-section">
        <h5 className="obj-section-label">{t('objects.pointsTo')}</h5>
        <div className="obj-grid">
          <PointerCard
            kind={kind}
            title={t(KIND_LABEL[kind])}
            hint={tag.targetSubject || t('objects.tagTargetHint')}
            sha={tag.object}
            onOpen={() => onFollow(tag.object, { via: 'target' })}
          />
          <IdentCard labelKey="objects.tagger" ident={parseGitIdent(tag.tagger)} raw={tag.tagger} />
        </div>
      </section>
      <section className="obj-section">
        <h5 className="obj-section-label">{t('objects.message')}</h5>
        <pre className="obj-card obj-message">{tag.message.trimEnd()}</pre>
      </section>
    </>
  )
}

function treeSize(child: TreeChild, t: Translate): string {
  const meaning = getModeMeaning(child.mode)
  if (meaning === 'submodule') return t('objects.submoduleSize')
  if (meaning === 'symlink' && child.target) return `→ ${child.target}`
  if (child.kind === 'tree') return child.count === undefined ? '' : itemCount(child.count, t)
  return child.size === null ? '' : formatBytes(child.size)
}

function TreeView({ object, onFollow }: { object: GitObject; onFollow: (sha: string, link: StepLink) => void }): React.JSX.Element {
  const t = useT()
  const entries = sortTreeEntries(object.tree ?? [])
  if (!entries.length) return <p className="settings-hint">{t('objects.emptyTree')}</p>
  return (
    <>
      <div className="obj-card obj-table">
        <div className="obj-row obj-row-head">
          <span />
          <span>{t('objects.colName')}</span>
          <span>{t('objects.colMode')}</span>
          <span>{t('objects.colObject')}</span>
          <span className="obj-end">
            {t('objects.colSize')}
          </span>
        </div>
        {entries.map((child) => {
          const meaning = getModeMeaning(child.mode)
          // A gitlink names a commit of another repository: there is nothing here to open.
          const openable = meaning !== 'submodule'
          const cells = (
            <>
              <span className={`obj-row-icon mode-${meaning}`} aria-hidden="true">
                {child.kind === 'commit' ? <GitCommitHorizontal size={15} /> : <KindGlyph kind={child.kind} size={15} />}
              </span>
              <span className="obj-row-name">{child.kind === 'tree' ? `${child.name}/` : child.name}</span>
              <span className="obj-row-mode">
                <code>{child.mode}</code>
                <span className={`obj-mode-chip mode-${meaning}`}>{t(MODE_LABEL[meaning])}</span>
              </span>
              <code className="obj-row-sha">
                {child.kind} {child.sha.slice(0, 7)}
              </code>
              <span className="obj-row-size obj-end">{treeSize(child, t)}</span>
            </>
          )
          return openable ? (
            <button
              key={`${child.sha}:${child.name}`}
              // Hover tints the row in its own kind's colour, as the kind badges.
              className={`obj-row kind-${child.kind}`}
             
              onClick={() => onFollow(child.sha, { via: 'entry', name: child.name, mode: child.mode })}
            >
              {cells}
            </button>
          ) : (
            <div key={`${child.sha}:${child.name}`} className="obj-row inert">
              {cells}
            </div>
          )
        })}
      </div>
      <p className="obj-caption">{t('objects.treeHint')}</p>
    </>
  )
}

function BlobView({ repoPath, object, step }: { repoPath: string; object: GitObject; step: TrailStep }): React.JSX.Element | null {
  const t = useT()
  const blob = object.blob
  if (!blob) return null
  const meaning = step.mode ? getModeMeaning(step.mode) : null
  const meaningText = meaning ? t(MODE_LONG[meaning] ?? MODE_LABEL[meaning]) : ''
  const commitSha = step.commit && /^[0-9a-f]{40,64}$/i.test(step.commit) ? step.commit : null
  const lines = blob.text === null ? [] : blob.text.replace(/\n$/, '').split('\n')
  return (
    <>
      {step.path && (
        <div className="obj-named">
          <Folder size={14} className="kind-tree" aria-hidden="true" />
          <span>
            {step.commit && step.mode
              ? interpNodes(t('objects.namedIn'), {
                  path: <b>{step.path}</b>,
                  commit: <code className="kind-commit">{shortCommit(step.commit)}</code>,
                  mode: <code>{step.mode}</code>,
                  meaning: meaningText
                })
              : step.commit
                ? interpNodes(t('objects.namedInCommit'), {
                    path: <b>{step.path}</b>,
                    commit: <code className="kind-commit">{shortCommit(step.commit)}</code>
                  })
                : interpNodes(t('objects.namedInTree'), { path: <b>{step.path}</b> })}
          </span>
          <span className="obj-spacer" />
          {commitSha && (
            <button
              className="obj-link"
              onClick={() => {
                const ui = useUIStore.getState()
                ui.closeModal()
                ui.setFileView({ repoPath, file: step.path!, source: { type: 'commit', hash: commitSha }, mode: 'history' })
              }}
            >
              {t('objects.fileHistory')}
            </button>
          )}
        </div>
      )}
      {blob.text === null ? (
        <p className="settings-hint">
          <Binary size={12} style={{ verticalAlign: '-2px', marginInlineEnd: 4 }} />
          {interp(t('objects.binary'), { size: formatBytes(object.size) })}
        </p>
      ) : (
        <div className="obj-card obj-code">
          {lines.map((line, i) => (
            <div key={i} className="obj-code-line">
              <span className="obj-code-no">{i + 1}</span>
              <span className="obj-code-text">{line || ' '}</span>
            </div>
          ))}
        </div>
      )}
      {blob.truncated && <p className="settings-hint">{t('objects.truncated')}</p>}
    </>
  )
}

/** Where this object sits among git's few moving parts, with the current kind lit. */
function ModelStrip({ kind }: { kind: GitObjectKind }): React.JSX.Element {
  const t = useT()
  const cells = MODEL.filter((m) => m.id !== 'tag' || kind === 'tag')
  return (
    <div className="obj-model" aria-label={t('objects.modelTitle')} role="group">
      <span className="obj-section-label">{t('objects.modelTitle')}</span>
      <div className="obj-model-row">
        {cells.map((cell, i) => {
          const here = cell.id === kind
          return (
            <span key={cell.id} className="obj-model-item">
              {i > 0 && <ArrowRight size={16} className="obj-model-arrow obj-flip" aria-hidden="true" />}
              <span className={`obj-model-cell kind-${cell.id} ${here ? 'here' : ''}`}>
                {/* i18n-ignore git's own names for its object types */}
                <b>{cell.id}</b> <span className="obj-dim">· {t(cell.hintKey)}</span>
                {here && <span className="obj-model-here">{t('objects.youAreHere')}</span>}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** The pane: what the object is, what it holds, and where it sits in the model. */
export function ObjectView({ repoPath, object, step, onFollow }: {
  repoPath: string
  object: GitObject
  step: TrailStep
  onFollow: (sha: string, link: StepLink) => void
}): React.JSX.Element {
  return (
    <>
      <ObjectHeader object={object} step={step} />
      {object.kind === 'commit' && <CommitView object={object} onFollow={onFollow} />}
      {object.kind === 'tag' && <TagView object={object} onFollow={onFollow} />}
      {object.kind === 'tree' && <TreeView object={object} onFollow={onFollow} />}
      {object.kind === 'blob' && <BlobView repoPath={repoPath} object={object} step={step} />}
      {/* A blob's code takes the free height itself; everything else leaves it empty. */}
      {object.kind !== 'blob' && <span className="obj-spacer" />}
      <ModelStrip kind={object.kind} />
    </>
  )
}
