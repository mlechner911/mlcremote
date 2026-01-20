import { ViewType } from '../types/layout'

/**
 * Maps file handler names to their corresponding ViewType.
 * This ensures files open with the correct view type for singleton behavior.
 */
export const HANDLER_TO_VIEW_TYPE: Record<string, ViewType> = {
    'Binary': 'binary',
    'Text': 'editor',
    'Markdown': 'editor',  // Markdown uses editor with preview
    'Pdf': 'preview',
    'Image': 'preview',
    'Video': 'preview',
    'Svg': 'preview',
    'Archive': 'preview',
    'Shell': 'terminal',
    'Unsupported': 'binary',  // Treat unsupported as binary (show metadata)
}

/**
 * Get the appropriate ViewType for a handler
 */
export function getViewTypeForHandler(handlerName: string): ViewType {
    return HANDLER_TO_VIEW_TYPE[handlerName] || 'editor'
}
