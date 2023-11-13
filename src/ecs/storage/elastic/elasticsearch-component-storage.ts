import { Client } from 'elasticsearch'
import { ComponentStorage } from '..'
import {} from '../../../middleware/aws/elasticsearch-client-middleware'

export class ElasticsearchComponentStorage<T> implements ComponentStorage<T> {
  constructor(
    protected readonly componentName: string,
    protected readonly client: Client,
  ) {}

  getIndex() {
    return `components_${this.componentName}`
  }

  read(entityId: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.client.get<T>(
        { id: entityId, index: this.getIndex(), type: 'object' },
        (error, response) => {
          if (error) {
            reject(error)
          } else if (!response.found) {
            resolve(undefined)
          } else {
            resolve(response._source)
          }
        },
      )
    })
  }

  async readOrThrow(entityId: string): Promise<T> {
    const value = await this.read(entityId)
    if (value === undefined) {
      throw new Error(
        `could not find component ${this.componentName} for entity ${entityId}`,
      )
    }
    return value
  }

  write(entityId: string, component: T): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.create(
        {
          id: entityId,
          index: this.getIndex(),
          type: 'object',
          body: component,
        },
        (error, _response) => {
          if (error) {
            reject(error)
          } else {
            resolve(undefined)
          }
        },
      )
    })
  }

  conditionalWrite(
    entityId: string,
    current: T,
    previous: T | undefined,
  ): Promise<void> {
    throw new Error('not implemented')
  }

  commitUpdateIndex(): Promise<void> {
    throw new Error('not implemented')
  }

  updates(
    cursor: string,
  ): AsyncGenerator<{ entityId: string; cursor: string }, any, unknown> {
    throw new Error('not implemented')
  }
}
