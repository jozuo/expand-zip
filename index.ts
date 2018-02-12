import Lambda from 'aws-lambda';
import * as AWS from 'aws-sdk';
import * as node_zip from 'node-zip';
import * as mime from 'mime-types';
import { ObjectIdentifier } from 'aws-sdk/clients/s3';

const DEST_BUCKET = 'cdn.jozuo.work';

const S3_CONFIG: AWS.S3.Types.ClientConfiguration = {
  endpoint: (process.env.NODE_ENV === 'local' ? 'http://localstack:4572' : undefined),
  s3ForcePathStyle: process.env.NODE_ENV === 'local',
  apiVersion: '2006-03-01',
};

const s3 = new AWS.S3(S3_CONFIG);

async function clearBucket() {
  const list = await s3.listObjects({
    Bucket: DEST_BUCKET,
  }, undefined).promise();

  if (!list || !list.Contents) {
    return;
  }

  let keys: ObjectIdentifier[] = list.Contents.map((object: AWS.S3.Object) => {
    return ({ Key: object.Key }) as ObjectIdentifier;
  });

  if (!keys) {
    return;
  }

  await s3.deleteObjects({
    Bucket: DEST_BUCKET,
    Delete: {
      Objects: keys
    },
  }).promise();
}

async function expandZip(srcFile: AWS.S3.GetObjectOutput) {
  const zip = new node_zip(srcFile.Body, { base64: false, checkCRC32: true });
  for (const fileName of Object.keys(zip.files)) {
    const file = zip.files[fileName];
    await s3.putObject({
      Bucket: DEST_BUCKET,
      Key: file.name,
      Body: new Buffer(file.asBinary(), 'binary'),
      ContentType: mime.lookup(file.name) || 'application/octet-stream'
    }).promise();
  }
}

export async function handler(event: Lambda.S3CreateEvent, context: Lambda.Context) {
  console.log('Received event:');

  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;

  const srcFile = await s3.getObject({
    Bucket: bucket,
    Key: key
  }).promise();
  await clearBucket();
  await expandZip(srcFile);

  context.succeed('Ok');
}