# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| main    | Yes                |
| < 1.0   | Beta - best effort |

## Reporting a Vulnerability

If you discover a security vulnerability in Wolkvorm, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **security@wolkvorm.com**

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix and disclosure:** Coordinated with reporter, typically within 30 days

### Process

1. Reporter sends details to security@wolkvorm.com
2. Maintainers acknowledge receipt and begin investigation
3. A fix is developed in a private branch
4. A security advisory is drafted
5. Fix is released and advisory is published
6. Reporter is credited (unless they prefer anonymity)

## Security Best Practices for Deployment

- Always use IAM Roles instead of static access keys
- Set `WOLKVORM_SECRET_KEY` to a strong, unique value for encrypting stored credentials
- Run Wolkvorm behind a reverse proxy with TLS (HTTPS)
- Restrict access to the Wolkvorm port (default 3000/8080) via security groups
- Regularly update Docker images to get security patches
