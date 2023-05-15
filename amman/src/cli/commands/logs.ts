import { maybeAmmanInstance } from '../utils'
import { pipeMiralandLogs } from '../utils/miraland-logs'

export function handleLogsCommand() {
  return pipeMiralandLogs(maybeAmmanInstance())
}
