# TW SaaS OpenAPI upload

This action creates a combines HTML documentation of SaaS services and uploads documentation to S3.

**Prerequisites**: There needs to be a `openapi-definition.yml` file in the root of the repository.

Also, you need to make sure the following environment variables exist

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ACCOUNT_NUMBER`

## Inputs

### `service`

**Required** The name of the service whose OpenAPI definition should be uploaded to S3, e.g. `organization`

## Example usage

```yaml
uses: Talentwunder/devops-github-actions-openapi-upload@main
with:
  service: 'organization'
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  AWS_ACCOUNT_NUMBER: ${{ secrets.AWS_ACCOUNT_NUMBER }}
```

Note: You need to make sure AWS credentials are available as environment variables.
