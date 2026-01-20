import { ViewType } from '../types/layout'

/**
 * Defines which view types should be singleton (only one tab open at a time).
 * Singleton tabs reuse the same tab when opened from different paths.
 */
export const VIEW_SINGLETON_DEFAULTS: Record<ViewType, boolean> = {
    'editor': false,        // Multiple files can be open
    'terminal': false,      // Multiple terminals
    'directory': true,      // Only one directory view
    'binary': true,         // Only one binary view
    'custom': true,         // Custom views are singleton by default
    'logs': true,           // Only one server logs view
    'preview': false,       // Multiple previews
    'diff': false,          // Multiple diffs
    'metadata': true,       // Only one metadata view
    'trash': true           // Only one trash view
}
