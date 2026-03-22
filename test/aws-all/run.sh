#!/bin/bash
set -e

LOG="test-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

echo "=========================================="
echo " Wolkvorm AWS Full Test"
echo " Log: $LOG"
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
echo "Started : $(date)"
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
echo " Finished: $(date)"
echo "=========================================="
echo ""
terraform output
echo ""
echo "Log saved to: $LOG"
echo ""
read -p "Destroy all resources now? [y/N] " DESTROY
if [[ "$DESTROY" == "y" || "$DESTROY" == "Y" ]]; then
  echo ""
  echo ">>> terraform destroy"
  terraform destroy -auto-approve
  echo ""
  echo "All resources destroyed. Finished: $(date)"
else
  echo "Resources are still running. When done, run:"
  echo "  terraform destroy -auto-approve"
fi
