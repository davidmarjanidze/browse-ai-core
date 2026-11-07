import { Pipe, PipeTransform } from '@angular/core'
import { formatString } from 'browse-ai-core'

/** `{{ t().contextUsage | bacFormat: { percent: 20 } }}` */
@Pipe({ name: 'bacFormat' })
export class FormatPipe implements PipeTransform {
  transform(template: string, values: Record<string, string | number>): string {
    return formatString(template, values)
  }
}
