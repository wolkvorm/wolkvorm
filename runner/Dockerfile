FROM alpine:3.19

RUN apk add --no-cache \
    bash \
    git \
    openssh \
    curl \
    unzip

# Detect architecture
ARG TARGETARCH

# Terraform
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      TERRAFORM_ARCH="arm64"; \
    else \
      TERRAFORM_ARCH="amd64"; \
    fi && \
    curl -Lo terraform.zip https://releases.hashicorp.com/terraform/1.7.5/terraform_1.7.5_linux_${TERRAFORM_ARCH}.zip && \
    unzip terraform.zip && \
    mv terraform /usr/local/bin/ && \
    rm terraform.zip

# Pre-cache AWS provider to avoid downloading on every run
ENV TF_PLUGIN_CACHE_DIR="/root/.terraform.d/plugin-cache"
RUN mkdir -p $TF_PLUGIN_CACHE_DIR /tmp/tf-init && \
    printf 'terraform {\n  required_providers {\n    aws = {\n      source  = "hashicorp/aws"\n      version = ">= 5.0"\n    }\n  }\n}\n' > /tmp/tf-init/main.tf && \
    cd /tmp/tf-init && \
    terraform providers mirror $TF_PLUGIN_CACHE_DIR && \
    rm -rf /tmp/tf-init

WORKDIR /workspace
ENTRYPOINT ["/bin/sh"]