/**
 * The repository this build is published from — where updates, release notes
 * and "report a problem" point.
 *
 * One constant on purpose: a fork that ships its own releases changes this and
 * `build.publish` in package.json, and every link follows. Left scattered, a
 * single missed copy would have the fork's builds offer the upstream release as
 * an "update" and replace themselves with it. `test/appRepo.test.ts` keeps the
 * two in step.
 */
import { GITHUB_COM, GITHUB_COM_ENDPOINTS } from './githubEnterprise'

export const APP_REPO = 'StarleyDev/githuttbr'

export const APP_REPO_URL = `${GITHUB_COM}/${APP_REPO}`
export const APP_ISSUES_NEW_URL = `${APP_REPO_URL}/issues/new`
export const APP_RELEASES_API = `${GITHUB_COM_ENDPOINTS.apiBase}/repos/${APP_REPO}/releases`
