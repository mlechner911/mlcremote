export interface TaskDef {
    id: string
    name: string
    command: string
    color: string
    icon: string
    showOnLaunch?: boolean
}

// Shared base for both Profile types
interface BaseProfile {
    /** SSH username */
    user: string
    /** Remote server hostname or IP (e.g., myserver.com) */
    host: string
    /** Local port where SSH tunnel listens (e.g., 8446) */
    localPort: number
    identityFile: string
    extraArgs: string[]
    remoteOS?: string
    remoteArch?: string
    remoteVersion?: string
    id?: string
    color?: string
    tasks: TaskDef[]
    defaultShell?: string
    rootPath?: string
    /** If true, shows developer UI controls (screenshot, server logs, session key) */
    showDeveloperControls?: boolean
}

/**
 * Runtime session profile (includes active SSH tunnel info).
 * Flow: localhost:localPort → SSH to host:port → forwards to remoteHost:remotePort
 */
export interface Profile extends BaseProfile {
    /** Where tunnel forwards TO on remote (usually 127.0.0.1) */
    remoteHost: string
    /** Backend port on remote side (e.g., 8443) */
    remotePort: number
}

/**
 * Saved connection profile configuration.
 * Stored in profiles.json and loaded on launch.
 */
export interface ConnectionProfile extends BaseProfile {
    name: string
    /** SSH port on remote server (default: 22) */
    port: number
    isWindows: boolean
    /** Unix timestamp of last connection */
    lastUsed: number
    /** 
     * Session mode: "default" or "parallel"
     * - "default": Reuses existing backend session if found (or empty "" string)
     * - "parallel": Always starts a new backend instance
     */
    mode?: string
}
