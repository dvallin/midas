import { ComponentStorage } from '../storage'
import { Linker } from './linker'

export class TreeLinker {
  constructor(
    private readonly toTree: ComponentStorage<{ parent?: string }>,
    private readonly linker: Linker,
  ) {}

  async link(from: string, to: string): Promise<void> {
    const node = await this.toTree.read(to)
    if (node) {
      await this.linker.link(from, to)
      if (node.parent) {
        return this.link(from, node.parent)
      }
    }
  }
  async unlink(from: string, to: string): Promise<void> {
    const node = await this.toTree.read(to)
    if (node) {
      await this.linker.unlink(from, to)
      if (node.parent) {
        return this.unlink(from, node.parent)
      }
    }
  }
}
