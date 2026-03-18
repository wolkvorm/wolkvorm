terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-s3-bucket.git//?ref=v4.0.0"
}

inputs = {
  bucket = "terragrunt-ui-test-bucket-12345"
  acl    = "private"
}