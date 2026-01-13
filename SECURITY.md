# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

This is an actively maintained personal finance application. We support only the latest version deployed to production.

## Reporting a Vulnerability

If you discover a security vulnerability in this project:

1. **Do not** open a public issue
2. Email the maintainers directly (or use GitHub Security Advisories)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

We aim to respond within 48 hours and provide a fix within 7 days for high-severity issues.

## Security Measures

- Weekly automated dependency scanning (Dependabot)
- Weekly static code scanning (njsscan)
- CI pipeline security audits (npm audit)
- Lock file committed for reproducible builds
- Environment variables for secrets (never committed)

## Update Policy

- **Critical vulnerabilities**: Patched immediately
- **High vulnerabilities**: Patched within 7 days
- **Moderate vulnerabilities**: Patched in next release
- **Low vulnerabilities**: Addressed during regular maintenance

## Dependency Management

Dependencies are automatically scanned and updated:

- Dependabot creates PRs for updates weekly
- npm audit runs in CI on every push
- Lock file is kept up-to-date

## Authentication

This application uses environment variable-based authentication. See AUTH\_\* variables in the documentation. Never commit credentials.
