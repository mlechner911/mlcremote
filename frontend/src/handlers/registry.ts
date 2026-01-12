import { FileHandler, DecideOpts } from './types'
import { ShellHandler, DirectoryHandler, PdfHandler, ImageHandler, MarkdownHandler, TextHandler, BinaryHandler, UnsupportedHandler } from './defaults'

const handlers: FileHandler[] = [
    ShellHandler,
    DirectoryHandler,
    PdfHandler,
    ImageHandler,
    MarkdownHandler,
    TextHandler,
    BinaryHandler,
    UnsupportedHandler
].sort((a, b) => b.priority - a.priority)

export function getHandler(opts: DecideOpts): FileHandler {
    for (const h of handlers) {
        if (h.matches(opts)) {
            return h
        }
    }
    return UnsupportedHandler
}
