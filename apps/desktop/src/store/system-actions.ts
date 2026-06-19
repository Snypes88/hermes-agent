import { getActionStatus, restartGateway } from '@/hermes'
import { upsertDesktopActionTask } from '@/store/activity'
import type { ActionResponse } from '@/types/hermes'

const POLL_ATTEMPTS = 18
const POLL_INTERVAL_MS = 1200
const POLL_TIMEOUT_S = 180

// Drive a backend action to completion, mirroring each tick into the activity
// rail so any surface (Cmd+K, Command Center) shows progress without
// re-implementing the poll loop.
async function trackAction(started: ActionResponse): Promise<void> {
  upsertDesktopActionTask({ exit_code: null, lines: [], name: started.name, pid: started.pid, running: true })

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    await new Promise(resolve => window.setTimeout(resolve, POLL_INTERVAL_MS))
    const status = await getActionStatus(started.name, POLL_TIMEOUT_S)
    upsertDesktopActionTask(status)

    if (!status.running) {
      return
    }
  }
}

// Restart the messaging gateway, surfacing progress in the activity rail.
export async function runGatewayRestart(): Promise<void> {
  await trackAction(await restartGateway())
}
