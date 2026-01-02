export function handleBOM(content: string): { text: string; hasBOM: boolean } {
    if (content.charCodeAt(0) === 0xFEFF) {
        return { text: content.slice(1), hasBOM: true };
    }
    return { text: content, hasBOM: false };
}

export function restoreBOM(content: string): string {
    return '\uFEFF' + content;
}
