/**
 * Special tab IDs and constants
 * 
 * These are NOT file paths - they are reserved IDs for special application views.
 * Using a prefix ensures they won't conflict with actual file paths on the filesystem.
 */

// Special tab ID prefix to avoid conflicts with real file paths
export const SPECIAL_TAB_PREFIX = '__special__'

// Special tab IDs
export const SPECIAL_TAB_IDS = {
    TRASH: `${SPECIAL_TAB_PREFIX}trash`,
    METADATA: `${SPECIAL_TAB_PREFIX}metadata`,
    BINARY: `${SPECIAL_TAB_PREFIX}binary`,
    SERVER_LOGS: `${SPECIAL_TAB_PREFIX}server-logs`,
    // DIRECTORY removed - now uses singleton flag system
} as const

// Helper to check if a tab ID is a special tab
export function isSpecialTab(id: string): boolean {
    return id.startsWith(SPECIAL_TAB_PREFIX)
}

// Helper to get the special tab type
export function getSpecialTabType(id: string): keyof typeof SPECIAL_TAB_IDS | null {
    switch (id) {
        case SPECIAL_TAB_IDS.TRASH: return 'TRASH'
        case SPECIAL_TAB_IDS.METADATA: return 'METADATA'
        case SPECIAL_TAB_IDS.BINARY: return 'BINARY'
        case SPECIAL_TAB_IDS.SERVER_LOGS: return 'SERVER_LOGS'
        default: return null
    }
}
