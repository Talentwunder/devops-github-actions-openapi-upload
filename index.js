import core from '@actions/core';
import exec from '@actions/exec';
import fs from 'fs';
import { merge } from 'openapi-merge';
import yaml from 'js-yaml';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

const BUCKET_NAME = process.env.AWS_OPENAPI_BUCKET;
const SUB_FOLDER = 'openapi-files';

const s3Client = new S3Client({ region: 'eu-central-1' });

/**
 * Returns a list of service names
 * Service names are extracted from file names in the /openapi folder of the bucket
 */
async function getServiceNames() {
  const data = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `${SUB_FOLDER}/`,
      Delimiter: '/',
    })
  );

  return data.Contents.reduce((fileNames, entry) => {
    const fileName = entry.Key;
    if (!fileName.includes('.yml')) return fileNames;

    return [
      ...fileNames,
      fileName.substring(fileName.indexOf('/') + 1, fileName.lastIndexOf('.')),
    ];
  }, []);
}

/**
 * Converts the ReadableStream to a String
 * @param {ReadableStream} stream
 * @returns {String}
 */
async function convertStreamToString(stream) {
  let streamAsString = '';
  for await (const chunk of stream) {
    streamAsString += chunk;
  }
  return streamAsString;
}

/**
 * Fetches the OpenAPI yaml files from S3 and converts them to JavaScript objects
 * @param {String[]} serviceNames
 * @returns {String[]} list of OpenAPI definitions
 */
async function generateListOfApiDefinitions(serviceNames) {
  const promiseList = serviceNames.map((serviceName) => {
    const getObjectCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${SUB_FOLDER}/${serviceName}.yml`,
    });
    return s3Client.send(getObjectCommand);
  });
  const responses = await Promise.all(promiseList);

  return (
    await Promise.all(
      responses.map((response) => convertStreamToString(response.Body))
    )
  ).map((apiDefinition) => yaml.load(apiDefinition));
}

/**
 * Merges the API definitions and writes the file to the file system
 * @param {String[]} listOfApiDefinitions
 */
function mergeApiDocs(listOfApiDefinitions) {
  const mergedApiDefinitions = merge(
    listOfApiDefinitions.map((definition) => ({
      oas: definition,
    }))
  );

  // write merged OpenAPI definition to file system
  fs.writeFileSync(
    './talentwunder-api.json',
    JSON.stringify(mergedApiDefinitions.output)
  );
}

/**
 * Generates the Talentwunder API HTML and writes it to the file system
 */
async function generateTalentwunderApiHtml() {
  await exec.exec(
    'npx --yes redoc-cli build -o talentwunder-api.html ./talentwunder-api.json'
  );
}

/**
 * Reads the Talentwunder API HTML doc from the file system and uploads it to S3
 */
async function uploadTalentwunderApiToS3() {
  const content = fs.readFileSync('./talentwunder-api.html');
  const putObjectParams = {
    Bucket: BUCKET_NAME,
    Key: 'index.html',
    Body: content,
    CacheControl: 'max-age=0,no-cache,no-store,must-revalidate',
    ContentType: 'text/html',
  };
  const putObjectCommand = new PutObjectCommand(putObjectParams);
  await s3Client.send(putObjectCommand);
}

/**
 * Generates a Talentwunder API HTML and pushes it to S3
 */
async function generateOpenApiDocs() {
  const serviceNames = await getServiceNames();

  const listOfApiDefinitions = await generateListOfApiDefinitions(serviceNames);

  mergeApiDocs(listOfApiDefinitions);

  await generateTalentwunderApiHtml();

  await uploadTalentwunderApiToS3();
}

/**
 * Upload OpenAPI definition that is located at the root of the repo
 * @param {String} serviceName e.g. 'organization'
 */
async function uploadOpenApiDefinition(serviceName) {
  const content = fs.readFileSync('./openapi-definition.yml');
  const putObjectParams = {
    Bucket: BUCKET_NAME,
    Key: `${SUB_FOLDER}/${serviceName}.yml`,
    Body: content,
    ContentType: 'text/x-yaml',
  };
  await s3Client.send(new PutObjectCommand(putObjectParams));
}

async function run() {
  try {
    console.log('Starting to create Talentwunder API documentation ...');
    const serviceName = core.getInput('service');

    console.log(`Uploading OpenAPI definition of ${serviceName} service ...`);
    await uploadOpenApiDefinition(serviceName);

    console.log('Generating API docs ...');
    await generateOpenApiDocs();

    console.log('All done!');
  } catch (e) {
    core.setFailed(e.message);
  }
}

run();
