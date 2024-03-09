import { nanoid } from 'nanoid'
import { EntityIdGenerator } from '.'

export class NanoIdGenerator implements EntityIdGenerator {
  generate(): string {
    return nanoid()
  }
}
