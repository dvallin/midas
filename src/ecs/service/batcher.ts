export class Batcher {
  constructor(private readonly batchSize: number) {}

  async *batch<T>(eventSource: AsyncGenerator<T>) {
    let batch: T[] = []
    for await (const event of eventSource) {
      batch.push(event)
      if (batch.length === this.batchSize) {
        yield batch
        batch = []
      }
    }
    yield batch
  }
}
