import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDbContext } from '../../../middleware'
import {
  CreateTableCommand,
  CreateTableCommandInput,
  DeleteTableCommand,
  ReturnConsumedCapacity,
} from '@aws-sdk/client-dynamodb'
import { DynamoDBStreams } from '@aws-sdk/client-dynamodb-streams'
import { Schema } from '@spaceteams/zap'

export type DynamoDbStorageContext = {
  ecs: {
    storage: {
      dynamodb: {
        config: {
          returnConsumedCapacity?: ReturnConsumedCapacity
        }
      }
    }
    components: {
      [name: string]: {
        type: 'key' | 'set' | 'array' | 'default'
        tracksUpdates: boolean
        schema?: Schema<unknown>
      }
    }
  }
}

export class DynamoDbStorage {
  protected readonly client: DynamoDBDocument
  protected readonly dynamoStreams: DynamoDBStreams
  protected readonly components: DynamoDbStorageContext['ecs']['components']
  protected readonly returnConsumedCapacity?: ReturnConsumedCapacity
  constructor(context: DynamoDbContext & DynamoDbStorageContext) {
    this.client = context.aws.dynamoDb
    this.dynamoStreams = context.aws.dynamoStreams
    this.components = context.ecs.components
    this.returnConsumedCapacity =
      context.ecs.storage.dynamodb.config.returnConsumedCapacity
  }

  getTableName(componentName: string) {
    return `components_${componentName}`
  }
  getUpdateTableName(componentName: string) {
    return `components_${componentName}_updates`
  }
  getUpdateTableSequenceNumberIndexName(componentName: string) {
    return `components_${componentName}_updates_sequenceNumbers`
  }
  getKeyedTableComponentIndexName(componentName: string) {
    return `components_${componentName}_keys`
  }

  getSchema(componentName: string) {
    return this.components[componentName].schema
  }

  async read(
    componentName: string,
    entityId: string,
  ): Promise<unknown | undefined> {
    const result = await this.client.get({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Key: { componentName, entityId },
    })
    return result.Item?.component
  }

  write(componentName: string, entityId: string, component: unknown) {
    return this.client.put({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      Item: {
        componentName,
        entityId,
        component,
      },
    })
  }

  async getByKey(componentName: string, key: string) {
    const componentType = this.components[componentName].type
    if (componentType !== 'key') {
      throw new Error(
        `cannot perform a get by key on component ${componentName} of type ${componentType}`,
      )
    }
    const result = await this.client.query({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
      IndexName: this.getKeyedTableComponentIndexName(componentName),
      KeyConditionExpression: `componentName = :componentName and component = :component`,
      ExpressionAttributeValues: {
        ':componentName': componentName,
        ':component': key,
      },
      ScanIndexForward: true,
    })
    return result.Items?.[0]?.entityId
  }

  async conditionalWrite(
    componentName: string,
    entityId: string,
    current: unknown,
    previous: unknown | undefined = undefined,
  ): Promise<void> {
    await this.client.put({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getTableName(componentName),
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
      TableName: this.getTableName(componentName),
      KeyConditionExpression: `componentName = :componentName`,
      ExpressionAttributeValues: {
        ':componentName': componentName,
      },
      ScanIndexForward: true,
    })
  }

  async updates(componentName: string, cursor: string) {
    const tracksUpdates = this.components[componentName].tracksUpdates
    if (!tracksUpdates) {
      throw new Error(
        `component ${componentName} does not support update tracking`,
      )
    }
    return await this.client.query({
      ReturnConsumedCapacity: this.returnConsumedCapacity,
      TableName: this.getUpdateTableName(componentName),
      IndexName: this.getUpdateTableSequenceNumberIndexName(componentName),
      KeyConditionExpression: `componentName = :componentName and sequenceNumber > :cursor`,
      ExpressionAttributeValues: {
        ':componentName': componentName,
        ':cursor': cursor,
      },
      ScanIndexForward: true,
    })
  }

  push(componentName: string, entityId: string, component: unknown) {
    const componentType = this.components[componentName].type
    if (componentType !== 'array') {
      throw new Error(
        `cannot perform a array:push on component ${componentName} of type ${componentType}`,
      )
    }
    return this.client.update({
      TableName: this.getTableName(componentName),
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

  add(componentName: string, entityId: string, component: unknown) {
    const componentType = this.components[componentName].type
    if (componentType !== 'set') {
      throw new Error(
        `cannot perform a setadd on component ${componentName} of type ${componentType}`,
      )
    }
    return this.client.update({
      TableName: this.getTableName(componentName),
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

  delete(componentName: string, entityId: string, component: unknown) {
    const componentType = this.components[componentName].type
    if (componentType !== 'set') {
      throw new Error(
        `cannot perform a set delete on component ${componentName} of type ${componentType}`,
      )
    }
    return this.client.update({
      TableName: this.getTableName(componentName),
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

  defaultPrimaryTableMigration(componentName: string): CreateTableCommandInput {
    return {
      TableName: this.getTableName(componentName),
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
    }
  }

  keyedPrimaryTableMigration(componentName: string): CreateTableCommandInput {
    return {
      TableName: this.getTableName(componentName),
      KeySchema: [
        { AttributeName: 'componentName', KeyType: 'HASH' },
        { AttributeName: 'entityId', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'componentName', AttributeType: 'S' },
        { AttributeName: 'entityId', AttributeType: 'S' },
        { AttributeName: 'component', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: this.getKeyedTableComponentIndexName(componentName),
          KeySchema: [
            { AttributeName: 'componentName', KeyType: 'HASH' },
            { AttributeName: 'component', KeyType: 'RANGE' },
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
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    }
  }

  updateTableMigration(componentName: string): CreateTableCommandInput {
    return {
      TableName: this.getUpdateTableName(componentName),
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
          IndexName: this.getUpdateTableSequenceNumberIndexName(componentName),
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
    }
  }

  async migrate() {
    for (const componentName of Object.keys(this.components)) {
      const { type, tracksUpdates } = this.components[componentName]
      let primaryTable: CreateTableCommandInput
      switch (type) {
        case 'array':
        case 'default':
        case 'set':
          primaryTable = this.defaultPrimaryTableMigration(componentName)
          break
        case 'key':
          primaryTable = this.keyedPrimaryTableMigration(componentName)
          break
      }

      let updateTable: CreateTableCommandInput | undefined
      if (tracksUpdates) {
        primaryTable.StreamSpecification = {
          StreamEnabled: true,
          StreamViewType: 'KEYS_ONLY',
        }
        updateTable = this.updateTableMigration(componentName)
      }

      await this.client.send(new CreateTableCommand(primaryTable))
      if (updateTable) {
        await this.client.send(new CreateTableCommand(updateTable))
        await this.awaitUpdateStreams(componentName)
      }
    }
  }

  async awaitUpdateStreams(componentName: string) {
    let done = false
    while (!done) {
      const { Streams } = await this.dynamoStreams.listStreams({
        TableName: this.getTableName(componentName),
      })
      for (const { StreamArn } of Streams ?? []) {
        const stream = await this.dynamoStreams.describeStream({
          StreamArn,
        })
        if (stream.StreamDescription?.StreamStatus === 'ENABLED') {
          done = true
        }
      }
    }
  }

  async commitUpdateIndex(componentName: string) {
    const { Streams } = await this.dynamoStreams.listStreams({
      TableName: this.getTableName(componentName),
    })
    for (const { StreamArn } of Streams ?? []) {
      const stream = await this.dynamoStreams.describeStream({
        StreamArn,
      })
      if (stream.StreamDescription?.StreamStatus !== 'ENABLED') {
        throw new Error('stream not enabled')
      }
      const shard = stream.StreamDescription?.Shards?.[0]
      if (shard) {
        const iterator = await this.dynamoStreams.getShardIterator({
          StreamArn,
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
            TableName: this.getUpdateTableName(componentName),
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
    for (const componentName of Object.keys(this.components)) {
      const { tracksUpdates } = this.components[componentName]
      await this.client.send(
        new DeleteTableCommand({
          TableName: this.getTableName(componentName),
        }),
      )
      if (tracksUpdates) {
        await this.client.send(
          new DeleteTableCommand({
            TableName: this.getUpdateTableName(componentName),
          }),
        )
      }
    }
  }
}
