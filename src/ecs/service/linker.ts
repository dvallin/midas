import { SetStorage } from '../storage'

export class Linker {
  constructor(
    private readonly from: SetStorage<string>,
    private readonly to?: SetStorage<string>,
  ) {}

  async link(from: string, to: string): Promise<void> {
    await this.from.add(from, to)
    if (this.to) {
      await this.to.add(to, from)
    }
  }
  async unlink(from: string, to: string): Promise<void> {
    await this.from.delete(from, to)
    if (this.to) {
      await this.to.delete(to, from)
    }
  }
}
