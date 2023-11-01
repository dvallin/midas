import { GenericContainer, StartedTestContainer } from 'testcontainers'

const containerUrl = (container: StartedTestContainer, port: number) =>
  `http://${container.getHost()}:${container.getMappedPort(port)}`

let sftp: StartedTestContainer
let localStack: StartedTestContainer
export async function setup() {
  localStack = await new GenericContainer('localstack/localstack')
    .withExposedPorts(4566)
    .start()

  process.env.LOCALSTACK_ENDPOINT = containerUrl(localStack, 4566)
  // This is necessary to communicate with localstack.
  process.env.S3_USE_PATH_STYLE = 'true'

  // Fix for missing credentials https://github.com/localstack/localstack/issues/6912
  process.env.AWS_ACCESS_KEY_ID = 'test'
  process.env.AWS_SECRET_ACCESS_KEY = 'test'
}

export async function teardown() {
  await sftp.stop()
  await localStack.stop()
}
