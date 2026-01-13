# Upgrade Notes

This document tracks deferred dependency upgrades and the rationale for deferring them.

## Tailwind CSS v4

**Status:** Deferred
**Current Version:** 3.4.19
**Latest Version:** 4.1.18
**Category:** Major version upgrade

### Reason for Deferral

Tailwind CSS v4 is a complete rewrite with significant breaking changes:

- New configuration file format (incompatible with v3 config)
- Breaking changes to utility class names
- New build process and tooling requirements
- Migration requires updating all components

### Why We're Deferring

1. **Low ROI**: Our current Tailwind configuration is simple with no complex features. The migration effort doesn't provide proportional value.
2. **Stable and Secure**: v3.4.x is stable, actively maintained, and receiving security updates.
3. **No Critical Features**: We don't require any v4-specific features for our current roadmap.
4. **Risk vs Reward**: High migration effort (2-4 hours) with low benefit for this project.

### When to Revisit

Consider upgrading to Tailwind v4 when:

- v4 reaches broader adoption and ecosystem maturity
- Project requires v4-specific features
- During a major UI refactor where migration fits naturally
- v3.x approaches end-of-life

### Migration Effort Estimate

- **Config migration:** 30 minutes
- **Component updates:** 1-2 hours
- **Testing:** 1 hour
- **Total:** 2.5-4 hours

### Security Notes

- Tailwind v3.4.x is NOT end-of-life
- Security patches are still being released for v3.x
- Dependabot configured to ignore v4 major updates
- Minor and patch updates for v3.x will continue automatically

### References

- Tailwind v4 announcement: https://tailwindcss.com/blog/tailwindcss-v4-alpha
- Migration guide: https://tailwindcss.com/docs/upgrade-guide
