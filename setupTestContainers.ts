import { GenericContainer, StartedTestContainer } from 'testcontainers'
import {
  ElasticsearchContainer,
  StartedElasticsearchContainer,
} from '@testcontainers/elasticsearch'

const containerUrl = (container: StartedTestContainer, port: number) =>
  `http://${container.getHost()}:${container.getMappedPort(port)}`

let localStack: StartedTestContainer
let elasticsearch: StartedElasticsearchContainer
export async function setup() {
  ;[localStack, elasticsearch] = await Promise.all([
    new GenericContainer('localstack/localstack:3.0.0')
      .withExposedPorts(4566)
      .start(),
    new ElasticsearchContainer().start(),
  ])

  process.env.LOCALSTACK_ENDPOINT = containerUrl(localStack, 4566)
  // This is necessary to communicate with localstack.
  process.env.S3_USE_PATH_STYLE = 'true'

  // Fix for missing credentials https://github.com/localstack/localstack/issues/6912
  process.env.AWS_ACCESS_KEY_ID = 'test'
  process.env.AWS_SECRET_ACCESS_KEY = 'test'

  process.env.ELASTICSEARCH_ENDPOINT = elasticsearch.getHttpUrl()
}

export async function teardown() {
  await localStack.stop()
  await elasticsearch.stop()
}
