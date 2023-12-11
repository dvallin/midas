import { InlineProgramArgs, LocalWorkspace } from '@pulumi/pulumi/automation'
import { s3 } from '@pulumi/aws'
import { PolicyDocument } from '@pulumi/aws/iam'
import { it } from 'vitest'

const pulumiProgram = () => {
  // Create a bucket and expose a website index document.
  const siteBucket = new s3.Bucket('s3-website-bucket', {
    website: {
      indexDocument: 'index.html',
    },
  })

  const indexContent = `<html><head>
<title>Hello S3</title><meta charset="UTF-8">
</head>
<body><p>Hello, world!</p><p>Made with ❤️ with <a href="https://pulumi.com">Pulumi</a></p>
</body></html>
`

  // Write our index.html into the site bucket.
  const object = new s3.BucketObject('index', {
    bucket: siteBucket,
    content: indexContent,
    contentType: 'text/html; charset=utf-8',
    key: 'index.html',
  })

  // Create an S3 Bucket Policy to allow public read of all objects in bucket.
  function publicReadPolicyForBucket(bucketName: string): PolicyDocument {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [
            `arn:aws:s3:::${bucketName}/*`, // Policy refers to bucket name explicitly.
          ],
        },
      ],
    }
  }

  // Set the access policy for the bucket so all objects are readable.
  const bucketPolicy = new s3.BucketPolicy('bucketPolicy', {
    bucket: siteBucket.bucket, // Refer to the bucket created earlier.
    policy: siteBucket.bucket.apply(publicReadPolicyForBucket), // Use output property `siteBucket.bucket`.
  })

  return Promise.resolve({
    websiteUrl: siteBucket.websiteEndpoint,
    bucketPolicy,
    object,
  })
}

const args: InlineProgramArgs = {
  stackName: 'dev',
  projectName: 'inlineNode',
  program: pulumiProgram,
}

it.skip('applies stack', async () => {
  console.log('here')

  const stack = await LocalWorkspace.createStack(args, {
    projectSettings: {
      name: 'test',
      runtime: 'nodejs',
      backend: { url: 'file://.' },
    },
    envVars: {
      PULUMI_CONFIG_PASSPHRASE: 'pass',
    },
  })
  console.log(stack)
  await stack.setAllConfig({
    'aws:region': { value: 'us-east-1' },
    'aws:accessKey': { value: 'test' },
    'aws:secretKey': { value: 'test' },
    'aws:skipCredentialsValidation': { value: 'true' },
    'aws:skipRequestingAccountId': { value: 'true' },
    'aws:endpoints': {
      value: JSON.stringify([
        {
          apigateway: process.env.LOCALSTACK_ENDPOINT!,
          cloudformation: process.env.LOCALSTACK_ENDPOINT!,
          cloudwatch: process.env.LOCALSTACK_ENDPOINT!,
          cloudwatchlogs: process.env.LOCALSTACK_ENDPOINT!,
          dynamodb: process.env.LOCALSTACK_ENDPOINT!,
          es: process.env.LOCALSTACK_ENDPOINT!,
          firehose: process.env.LOCALSTACK_ENDPOINT!,
          iam: process.env.LOCALSTACK_ENDPOINT!,
          kinesis: process.env.LOCALSTACK_ENDPOINT!,
          kms: process.env.LOCALSTACK_ENDPOINT!,
          lambda: process.env.LOCALSTACK_ENDPOINT!,
          redshift: process.env.LOCALSTACK_ENDPOINT!,
          route53: process.env.LOCALSTACK_ENDPOINT!,
          s3: process.env.LOCALSTACK_ENDPOINT!,
          ses: process.env.LOCALSTACK_ENDPOINT!,
          sns: process.env.LOCALSTACK_ENDPOINT!,
          sqs: process.env.LOCALSTACK_ENDPOINT!,
          ssm: process.env.LOCALSTACK_ENDPOINT!,
          sts: process.env.LOCALSTACK_ENDPOINT!,
        },
      ]),
    },
  })
  await stack.workspace.installPlugin('aws', 'v4.0.0')
  const upRes = await stack.up({ onOutput: console.info })
  console.log(upRes)
})
