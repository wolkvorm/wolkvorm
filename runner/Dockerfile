FROM alpine:3.19

RUN apk add --no-cache \
    bash \
    git \
    openssh \
    curl \
    unzip

ARG TARGETARCH

# Install Terraform
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      TF_ARCH="arm64"; \
    else \
      TF_ARCH="amd64"; \
    fi && \
    curl -Lo terraform.zip https://releases.hashicorp.com/terraform/1.7.5/terraform_1.7.5_linux_${TF_ARCH}.zip && \
    unzip terraform.zip && \
    mv terraform /usr/local/bin/ && \
    rm terraform.zip

# Install OpenTofu
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      OTF_ARCH="arm64"; \
    else \
      OTF_ARCH="amd64"; \
    fi && \
    curl -Lo tofu.zip "https://github.com/opentofu/opentofu/releases/download/v1.9.0/tofu_1.9.0_linux_${OTF_ARCH}.zip" && \
    unzip tofu.zip -d /tmp/tofu && \
    mv /tmp/tofu/tofu /usr/local/bin/ && \
    rm -rf tofu.zip /tmp/tofu

# IAC_ENGINE: "terraform" (default) or "tofu"
ENV IAC_ENGINE="terraform"

# Pre-cache AWS provider for both engines
ENV TF_PLUGIN_CACHE_DIR="/root/.terraform.d/plugin-cache"
RUN mkdir -p $TF_PLUGIN_CACHE_DIR /tmp/tf-init && \
    printf 'terraform {\n  required_providers {\n    aws = {\n      source  = "hashicorp/aws"\n      version = ">= 5.0"\n    }\n  }\n}\n' > /tmp/tf-init/main.tf && \
    cd /tmp/tf-init && \
    terraform providers mirror $TF_PLUGIN_CACHE_DIR && \
    rm -rf /tmp/tf-init

WORKDIR /workspace
ENTRYPOINT ["/bin/sh"]