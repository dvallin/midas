import { EntityId } from '../entity'
import { SetStorage } from '../component'

export class Linker {
  constructor(
    private readonly from: SetStorage<EntityId>,
    private readonly to?: SetStorage<EntityId>,
  ) {}

  async link(from: EntityId, to: EntityId): Promise<void> {
    await this.from.add(from, to)
    if (this.to) {
      await this.to.add(to, from)
    }
  }
  async unlink(from: EntityId, to: EntityId): Promise<void> {
    await this.from.delete(from, to)
    if (this.to) {
      await this.to.delete(to, from)
    }
  }
}
