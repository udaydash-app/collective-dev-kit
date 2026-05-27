/**
 * Unified DB client. In Electron (where window.localDb is exposed by the
 * preload script) we route to the embedded PGlite instance; in the browser
 * PWA fallback we keep talking to Supabase directly.
 *
 * Existing code can be migrated incrementally:
 *   - `import { supabase } from '@/integrations/supabase/client'`  ← unchanged for browser
 *   - `import { db } from '@/integrations/db/client'`             ← new, prefers local
 *
 * Once a page uses `db`, it works offline on the desktop app and against
 * the cloud in the browser, with no per-page `shouldUseLocalData()` branch.
 */

import { supabase } from '@/integrations/supabase/client';
import { localDb, isElectron } from './localDb';

export const db: any = isElectron() ? localDb : supabase;
export { isElectron };