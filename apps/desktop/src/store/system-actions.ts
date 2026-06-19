import { getActionStatus, restartGateway } from '@/hermes'
import { translateNow } from '@/i18n'
import { upsertDesktopActionTask } from '@/store/activity'
import { dismissNotification, notify, notifyError } from '@/store/notifications'
import type { ActionResponse, ActionStatusResponse } from '@/types/hermes'

const POLL_ATTEMPTS = 18
const POLL_INTERVAL_MS = 1200
const POLL_TIMEOUT_S = 180
const GATEWAY_RESTART_TOAST = 'gateway-restart'

// Drive a backend action to completion, mirroring each tick into the activity
// rail so any surface shows progress without re-implementing the poll loop.
async function trackAction(started: ActionResponse): Promise<ActionStatusResponse | null> {
  upsertDesktopActionTask({ exit_code: null, lines: [], name: started.name, pid: started.pid, running: true })

  let last: ActionStatusResponse | null = null

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    await new Promise(resolve => window.setTimeout(resolve, POLL_INTERVAL_MS))
    last = await getActionStatus(started.name, POLL_TIMEOUT_S)
    upsertDesktopActionTask(last)

    if (!last.running) {
      return last
    }
  }

  return last
}

// Restart the messaging gateway with toast feedback (start → result) layered on
// top of the activity-rail progress. Self-contained and never rejects, so every
// trigger — Cmd+K, the messaging save/toggle toasts — gets identical feedback
// and error handling from a plain `void runGatewayRestart()`.
export async function runGatewayRestart(): Promise<void> {
  notify({
    id: GATEWAY_RESTART_TOAST,
    kind: 'info',
    title: translateNow('commandCenter.restartGateway'),
    message: translateNow('commandCenter.gatewayRestarting'),
    durationMs: 0
  })

  try {
    const status = await trackAction(await restartGateway())
    const failed = status?.exit_code != null && status.exit_code !== 0

    notify({
      id: GATEWAY_RESTART_TOAST,
      kind: failed ? 'error' : 'success',
      title: translateNow('commandCenter.restartGateway'),
      message: translateNow(failed ? 'commandCenter.gatewayRestartFailed' : 'commandCenter.gatewayRestarted')
    })
  } catch (err) {
    dismissNotification(GATEWAY_RESTART_TOAST)
    notifyError(err, translateNow('commandCenter.gatewayRestartFailed'))
  }
}
