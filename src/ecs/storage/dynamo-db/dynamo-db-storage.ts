import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDbContext } from '../../../middleware'
import {
  CreateTableCommand,
  DeleteTableCommand,
  ReturnConsumedCapacity,
} from '@aws-sdk/client-dynamodb'

export type DynamoDbStorageContext = {
  ecs: {
    storage: {
      dynamodb: {
        config: {
          returnConsumedCapacity?: ReturnConsumedCapacity
          tableName: string
        }
      }
    }
  }
}

export class DynamoDbStorage {
  protected readonly client: DynamoDBDocument
  protected readonly tableName: string
  protected readonly returnConsumedCapacity?: ReturnConsumedCapacity
  constructor(context: DynamoDbContext & DynamoDbStorageContext) {
    this.client = context.aws.dynamoDb
    this.tableName = context.ecs.storage.dynamodb.config.tableName
    this.returnConsumedCapacity =
      context.ecs.storage.dynamodb.config.returnConsumedCapacity
  }

  async read<T>(
    componentName: string,
    entityId: string,
  ): Promise<T | undefined> {
    const result = await this.client.get({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.tableName,
      Key: { componentName, entityId },
    })
    return result.Item?.component
  }

  write<T>(componentName: string, entityId: string, component: T) {
    const lastModified = this.now()
    return this.client.put({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.tableName,
      Item: {
        componentName,
        entityId,
        component,
        lastModified,
      },
    })
  }

  async conditionalWrite<T>(
    componentName: string,
    entityId: string,
    current: T,
    previous: T | undefined = undefined,
  ): Promise<void> {
    const lastModified = this.now()
    await this.client.put({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.tableName,
      Item: {
        componentName,
        entityId,
        component: current,
        lastModified,
      },
      ConditionExpression: previous
        ? 'component = :previousValue'
        : 'attribute_not_exists(component)',
      ExpressionAttributeValues: previous
        ? { ':previousValue': previous }
        : undefined,
    })
  }

  all(componentName: string) {
    return this.client.query({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.tableName,
      KeyConditionExpression: `componentName = :componentName`,
      ExpressionAttributeValues: {
        ':componentName': componentName,
      },
      ScanIndexForward: true,
    })
  }

  updates(componentName: string, startDate: number, endDate?: number) {
    return this.client.query({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.tableName,
      IndexName: `${this.tableName}LastModifiedGSI`,
      KeyConditionExpression:
        `componentName = :componentName and lastModified > :startDate ${
          endDate ? 'and lastModified < :endDate' : ''
        }`,
      ExpressionAttributeValues: {
        ':componentName': componentName,
        ':startDate': startDate,
        ':endDate': endDate,
      },
      ScanIndexForward: true,
    })
  }

  push<T>(componentName: string, entityId: string, component: T) {
    return this.client.update({
      TableName: this.tableName,
      Key: {
        componentName,
        entityId,
      },
      UpdateExpression:
        'SET #component.boxed = list_append(#component.boxed, :values)',
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: {
        ':values': [component],
      },
      ConditionExpression: 'attribute_exists(component)',
      ReturnValues: 'NONE',
    })
  }

  add<T>(componentName: string, entityId: string, component: T) {
    return this.client.update({
      TableName: this.tableName,
      Key: {
        componentName,
        entityId,
      },
      UpdateExpression: 'ADD #component.boxed :value',
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: {
        ':value': new Set([component]),
      },
      ConditionExpression: 'attribute_exists(component)',
      ReturnValues: 'NONE',
    })
  }
  delete<T>(componentName: string, entityId: string, component: T) {
    return this.client.update({
      TableName: this.tableName,
      Key: {
        componentName,
        entityId,
      },
      UpdateExpression: 'DELETE #component.boxed :value',
      ExpressionAttributeNames: {
        '#component': 'component',
      },
      ExpressionAttributeValues: {
        ':value': new Set([component]),
      },
      ConditionExpression: 'attribute_exists(component)',
      ReturnValues: 'NONE',
    })
  }

  async migrate() {
    await this.client.send(
      new CreateTableCommand({
        TableName: this.tableName,
        KeySchema: [
          { AttributeName: 'componentName', KeyType: 'HASH' },
          { AttributeName: 'entityId', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'componentName', AttributeType: 'S' },
          { AttributeName: 'entityId', AttributeType: 'S' },
          { AttributeName: 'lastModified', AttributeType: 'N' },
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
        GlobalSecondaryIndexes: [
          {
            IndexName: `${this.tableName}LastModifiedGSI`,
            KeySchema: [
              { AttributeName: 'componentName', KeyType: 'HASH' },
              { AttributeName: 'lastModified', KeyType: 'RANGE' },
            ],
            Projection: {
              ProjectionType: 'KEYS_ONLY',
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
      }),
    )
  }

  async teardown() {
    await this.client.send(
      new DeleteTableCommand({
        TableName: this.tableName,
      }),
    )
  }

  private now(): number {
    return performance.timeOrigin + performance.now()
  }
}
