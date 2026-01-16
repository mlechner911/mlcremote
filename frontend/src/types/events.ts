export type AppEventType =
    | 'set-theme'
    | 'screenshot'
    | 'run-task'
    | 'set-tasks'
    | 'open-logs'
    | 'app-ready';

export interface BaseEvent {
    type: AppEventType;
}

export interface SetThemeEvent extends BaseEvent {
    type: 'set-theme';
    theme: 'dark' | 'light';
}

export interface ScreenshotEvent extends BaseEvent {
    type: 'screenshot';
    filename?: string;
}

export interface RunTaskEvent extends BaseEvent {
    type: 'run-task';
    command: string;
    name?: string;
    icon?: string;
    color?: string;
}

export interface SetTasksEvent extends BaseEvent {
    type: 'set-tasks';
    tasks: any[]; // refined in api.ts as TaskDef[], keeping simple here or importing
}

export interface OpenLogsEvent extends BaseEvent {
    type: 'open-logs';
}

export interface AppReadyEvent extends BaseEvent {
    type: 'app-ready';
}

export type AppEvent =
    | SetThemeEvent
    | ScreenshotEvent
    | RunTaskEvent
    | SetTasksEvent
    | OpenLogsEvent
    | AppReadyEvent;
