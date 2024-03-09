import { v4 } from 'uuid'
import { EntityIdGenerator } from '.'

export class UuidGenerator implements EntityIdGenerator {
  generate(): string {
    return v4()
  }
}
