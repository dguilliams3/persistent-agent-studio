# Claude API Pricing Reference

**Last Updated:** 2026-01-19
**Source:** [Anthropic Pricing](https://www.anthropic.com/pricing)

## Current Pricing (per million tokens)

| Model | Input | Output | Batch Input | Batch Output |
|-------|-------|--------|-------------|--------------|
| **Opus 4.5** | $5.00 | $25.00 | $2.50 | $12.50 |
| **Sonnet 4.5** | $3.00 | $15.00 | $1.50 | $7.50 |
| **Haiku 4.5** | $1.00 | $5.00 | $0.50 | $2.50 |

## Prompt Caching

- **Cache reads:** $0.50/MTok (90% discount from base input price)
- **Cache writes:** 1.25x premium for 5-min TTL, 2x premium for 1-hour TTL

## Typical Cycle Costs (11K input, 300 output)

| Configuration | Cost/Cycle | Notes |
|---------------|------------|-------|
| Opus 4.5 + Batch (no cache) | ~3.1¢ | Baseline |
| Opus 4.5 + Batch + Cache hit | ~1.5¢ | Best case |
| Opus 4.5 + Batch + Cache write | ~6¢ | 1-hour TTL premium |
| Sonnet 4.5 + Batch | ~1.2¢ | Good balance |
| Haiku 4.5 + Batch | ~0.5¢ | Most economical |

## Cost Optimization Strategies

1. **Use batch mode (50% off)** - enabled by default overnight
2. **Maximize cache hits** by aligning TTL with cycle interval
3. **Consider Haiku** for routine THINK/EXIST cycles, Opus for conversations

## Related

- [Cloudflare Billing](./CLOUDFLARE_BILLING.md) - Worker and D1 costs
- [Anthropic Pricing Page](https://www.anthropic.com/pricing) - Official source
