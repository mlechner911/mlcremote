import prettier from 'prettier/standalone'
import parserBabel from 'prettier/parser-babel'
import parserTypescript from 'prettier/parser-typescript'
import parserYaml from 'prettier/parser-yaml'
import parserToml from 'prettier-plugin-toml'

export function formatByExt(ext: string, text: string): string {
  try {
    switch (ext) {
      case 'js':
      case 'jsx':
        return prettier.format(text, { parser: 'babel', plugins: [parserBabel], singleQuote: true })
      case 'ts':
      case 'tsx':
        return prettier.format(text, { parser: 'typescript', plugins: [parserTypescript], singleQuote: true })
      case 'json':
        return prettier.format(text, { parser: 'json' })
      case 'yaml':
      case 'yml':
        return prettier.format(text, { parser: 'yaml', plugins: [parserYaml] })
      case 'toml':
        // prettier-plugin-toml exposes itself as a parser plugin
        return prettier.format(text, { parser: 'toml', plugins: [parserToml as any] })
      case 'md':
      case 'markdown':
        return prettier.format(text, { parser: 'markdown' })
      case 'ini':
      case 'env':
      case 'txt':
      default:
        // fallback: normalize line endings
        return text.replace(/\r\n?/g, '\n')
    }
  } catch (e) {
    console.warn('format failed', e)
    return text
  }
}
