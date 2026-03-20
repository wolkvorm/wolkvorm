#!/bin/bash
set -e

echo "=========================================="
echo " Wolkvorm AWS Full Test"
echo "=========================================="
echo ""

# Check AWS credentials
if ! aws sts get-caller-identity > /dev/null 2>&1; then
  echo "ERROR: AWS credentials not configured!"
  echo "Run: aws configure"
  exit 1
fi

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_DEFAULT_REGION:-eu-central-1}
echo "Account : $ACCOUNT"
echo "Region  : $REGION"
echo ""

# Init
echo ">>> terraform init"
terraform init -upgrade

# Plan
echo ""
echo ">>> terraform plan (checking all 24 modules)"
terraform plan -out=tfplan

echo ""
echo "Plan SUCCESS. All 24 modules validated."
echo ""
read -p "Apply now? This will create real AWS resources (~\$0.15-0.20/hour). [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# Apply
echo ""
echo ">>> terraform apply"
terraform apply tfplan

echo ""
echo "=========================================="
echo " All resources deployed successfully!"
echo "=========================================="
echo ""
terraform output
echo ""
echo "When done testing, run:"
echo "  terraform destroy -auto-approve"
