import { describe, expect, it, vi } from 'vitest'
import { defaultProfile, type AppSettings } from '../src/shared/types'

const saved: AppSettings[] = []
vi.mock('../src/renderer/src/infrastructure/api', () => ({
  settingsApi: {
    set: vi.fn(async (s: AppSettings) => {
      saved.push(s)
    }),
    // An import reads the settings back from main afterwards: here, what was saved.
    get: vi.fn(async () => ({ settings: saved.at(-1), generation: 1 }))
  },
  reposApi: {}
}))

import { useSettingsStore } from '../src/renderer/src/stores/settings'

// An export written before GitLab servers were a list, imported in the
// renderer: it must come out as one server, token and link included, and what
// is sent to main must already be the new shape.
describe('importing a one-instance GitLab export', () => {
  it('turns the address into a server entry with its token and link', async () => {
    const link = { source: 'git' as const, login: 'work-user' }
    const exported = {
      profiles: [
        {
          ...defaultProfile(),
          id: 'work',
          name: 'Work',
          gitlabUrl: 'https://git.example.org/gitlab',
          gitlabToken: 'glpat-exported',
          gitlabTokenIssuer: 'https://git.example.org/gitlab',
          links: { gitlab: link }
        }
      ],
      activeProfileId: 'work'
    } as unknown as Partial<AppSettings>
    await useSettingsStore.getState().importSettings(exported)

    const profile = useSettingsStore.getState().settings.profiles[0]
    expect(profile).not.toHaveProperty('gitlabUrl')
    expect(profile.gitlabServers).toEqual([{ url: 'https://git.example.org/gitlab', token: 'glpat-exported', link }])
    expect(profile.gitlabToken).toBe('')
    expect(profile.links?.gitlab).toBeUndefined()
    expect(saved.at(-1)?.profiles[0]).not.toHaveProperty('gitlabUrl')
  })
})
