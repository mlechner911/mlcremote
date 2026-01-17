import { FileHandler, DecideOpts } from './types'
import { PdfHandler } from '../components/views/PdfView'
import { ShellHandler } from '../components/views/ShellView'
import { VideoHandler } from '../components/views/VideoView'
import { ImageHandler } from '../components/views/ImageView'
import { ArchiveHandler } from '../components/views/ArchiveViewer'
import { MarkdownHandler } from '../components/views/MarkdownView'
import { TextHandler } from '../components/views/TextView'
import { DirectoryHandler } from '../components/views/DirectoryView'
import { BinaryHandler } from '../components/views/BinaryView'
import { UnsupportedHandler } from '../components/views/UnsupportedView'

import { SvgHandler } from '../components/views/SvgView'

const handlers: FileHandler[] = [
    ShellHandler,
    DirectoryHandler,
    PdfHandler,
    SvgHandler,
    ImageHandler,
    VideoHandler,
    ArchiveHandler,
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
