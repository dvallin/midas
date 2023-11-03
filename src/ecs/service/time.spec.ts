import { it } from 'vitest'
import { Time } from './time'
it(
  'does skew',
  () => {
    const time = new Time()
    return new Promise((resolve) => {
      setInterval(() => {
        const t = Math.floor(time.now)
        if (Math.abs(t - Date.now()) > 1) {
          console.log(time.now, t, Date.now())
          resolve(undefined)
        }
      })
    })
  },
  { timeout: 1_000_000_000 },
)
