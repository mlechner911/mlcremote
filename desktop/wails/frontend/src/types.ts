export interface TaskDef {
    id: string
    name: string
    command: string
    color: string
    icon: string
    showOnLaunch?: boolean
}

export interface Profile {
    user: string
    host: string
    localPort: number
    remoteHost: string
    remotePort: number
    identityFile: string
    extraArgs: string[]
    remoteOS?: string
    remoteArch?: string
    remoteVersion?: string
    id?: string
    color?: string
    tasks?: TaskDef[]
}

export interface ConnectionProfile {
    id?: string
    name: string
    color: string
    user: string
    host: string
    port: number
    localPort: number
    identityFile: string
    isWindows: boolean
    lastUsed: number
    extraArgs: string[]
    remoteOS?: string
    remoteArch?: string
    remoteVersion?: string
    mode?: string
    tasks?: TaskDef[]
}
