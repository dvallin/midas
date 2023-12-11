import { EntityId } from '../entity'
import { ComponentStorage } from '../component'
import { Linker } from './linker'

export class TreeLinker {
  constructor(
    private readonly toTree: ComponentStorage<{ parent?: EntityId }>,
    private readonly linker: Linker,
  ) {}

  async link(from: EntityId, to: EntityId): Promise<void> {
    const node = await this.toTree.read(to)
    if (node) {
      await this.linker.link(from, to)
      if (node.parent) {
        return this.link(from, node.parent)
      }
    }
  }
  async unlink(from: EntityId, to: EntityId): Promise<void> {
    const node = await this.toTree.read(to)
    if (node) {
      await this.linker.unlink(from, to)
      if (node.parent) {
        return this.unlink(from, node.parent)
      }
    }
  }
}
