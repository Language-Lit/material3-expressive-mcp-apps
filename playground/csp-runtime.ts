// Evaluate before SDK schema imports: Firefox reports even caught eval probes.
// Zod is already a development fixture/SDK peer; it is not a companion dependency.
import { z } from 'zod'
z.config({ jitless: true })
