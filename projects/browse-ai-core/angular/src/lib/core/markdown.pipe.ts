import { Pipe, PipeTransform } from '@angular/core'
import { marked } from 'marked'

/** Markdown to HTML. Bind it with [innerHTML], which Angular sanitizes. */
@Pipe({ name: 'bacMarkdown' })
export class MarkdownPipe implements PipeTransform {
  transform(value: string): string {
    return marked.parse(value, { async: false, breaks: true, gfm: true })
  }
}
