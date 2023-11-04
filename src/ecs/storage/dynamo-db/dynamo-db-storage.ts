import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDbContext } from '../../../middleware'
import {
  CreateTableCommand,
  DeleteTableCommand,
  ReturnConsumedCapacity,
} from '@aws-sdk/client-dynamodb'
import { DynamoDBStreams } from '@aws-sdk/client-dynamodb-streams'

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
  protected readonly dynamoStreams: DynamoDBStreams
  protected readonly tableName: string
  protected readonly returnConsumedCapacity?: ReturnConsumedCapacity
  constructor(context: DynamoDbContext & DynamoDbStorageContext) {
    this.client = context.aws.dynamoDb
    this.dynamoStreams = context.aws.dynamoStreams
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
    return this.client.put({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.tableName,
      Item: {
        componentName,
        entityId,
        component,
      },
    })
  }

  async conditionalWrite<T>(
    componentName: string,
    entityId: string,
    current: T,
    previous: T | undefined = undefined,
  ): Promise<void> {
    await this.client.put({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.tableName,
      Item: {
        componentName,
        entityId,
        component: current,
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

  async updates(componentName: string, cursor: string) {
    return await this.client.query({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: `${this.tableName}_updates`,
      IndexName: `${this.tableName}_updates_sequenceNumbers`,
      KeyConditionExpression: `componentName = :componentName and sequenceNumber > :cursor`,
      ExpressionAttributeValues: {
        ':componentName': componentName,
        ':cursor': cursor,
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
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: 'KEYS_ONLY',
        },
      }),
    )

    await this.client.send(
      new CreateTableCommand({
        TableName: `${this.tableName}_updates`,
        KeySchema: [
          { AttributeName: 'componentName', KeyType: 'HASH' },
          { AttributeName: 'entityId', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'componentName', AttributeType: 'S' },
          { AttributeName: 'entityId', AttributeType: 'S' },
          { AttributeName: 'sequenceNumber', AttributeType: 'S' },
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
        GlobalSecondaryIndexes: [
          {
            IndexName: `${this.tableName}_updates_sequenceNumbers`,
            KeySchema: [
              { AttributeName: 'componentName', KeyType: 'HASH' },
              { AttributeName: 'sequenceNumber', KeyType: 'RANGE' },
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

    await this.awaitUpdateStream()
  }

  async awaitUpdateStream() {
    const { Streams } = await this.dynamoStreams.listStreams({
      TableName: this.tableName,
    })
    const arn = Streams?.[0].StreamArn
    if (arn) {
      let done = false
      while (!done) {
        const stream = await this.dynamoStreams.describeStream({
          StreamArn: arn,
        })
        if (stream.StreamDescription?.StreamStatus === 'ENABLED') {
          done = true
        }
      }
    }
  }

  async commitUpdateIndex() {
    const { Streams } = await this.dynamoStreams.listStreams({
      TableName: this.tableName,
    })
    const arn = Streams?.[0].StreamArn
    if (arn) {
      const stream = await this.dynamoStreams.describeStream({
        StreamArn: arn,
      })
      if (stream.StreamDescription?.StreamStatus !== 'ENABLED') {
        throw new Error('stream not enabled')
      }
      const shard = stream.StreamDescription?.Shards?.[0]
      if (shard) {
        const iterator = await this.dynamoStreams.getShardIterator({
          StreamArn: arn,
          ShardId: shard.ShardId,
          ShardIteratorType: 'AFTER_SEQUENCE_NUMBER',
          SequenceNumber: shard.SequenceNumberRange?.StartingSequenceNumber,
        })
        const records = await this.dynamoStreams.getRecords({
          ShardIterator: iterator.ShardIterator,
        })
        for (const record of records.Records ?? []) {
          await this.client.put({
            ReturnConsumedCapacity: this.returnConsumedCapacity,
            TableName: `${this.tableName}_updates`,
            Item: {
              componentName: record.dynamodb?.Keys?.componentName.S,
              entityId: record.dynamodb?.Keys?.entityId.S,
              sequenceNumber: record.dynamodb?.SequenceNumber,
            },
          })
        }
      }
    }
  }

  async teardown() {
    await this.client.send(
      new DeleteTableCommand({
        TableName: this.tableName,
      }),
    )
    await this.client.send(
      new DeleteTableCommand({
        TableName: `${this.tableName}_updates`,
      }),
    )
  }
}
