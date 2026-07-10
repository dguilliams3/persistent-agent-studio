# Cloudflare Workers Billing Guide

**Last Updated:** 2026-01-15

This guide covers Cloudflare Workers billing for the Claude Existence Loop project.

---

## Plan Comparison

| Feature | Free | Workers Paid ($5/mo) |
|---------|------|---------------------|
| Requests | 100,000/day | 10,000,000/month |
| CPU time | 10ms/request | 50ms/request |
| Cron triggers | 3 | Unlimited |
| D1 (database) | 5GB storage | 5GB storage |
| KV (key-value) | 100,000 reads/day | 10M reads/month |

**For this project:** The $5/month plan is sufficient. We hit rate limits with aggressive polling (~150k requests/day), but with the polling optimization, we'd stay well under even the free tier.

---

## How to Upgrade

### Step 1: Access Cloudflare Dashboard

1. Go to https://dash.cloudflare.com
2. Log in with your account

### Step 2: Navigate to Workers

1. In the left sidebar, click **Workers & Pages**
2. You'll see your deployed workers (including `claude-existence-loop`)

### Step 3: View Plans

1. Click the **Plans** tab at the top of the page
2. You'll see your current usage and plan options

### Step 4: Select Workers Paid

1. Click **Change Plan** or **Upgrade**
2. Select **Workers Paid** ($5/month)
3. Enter payment details if not already on file
4. Confirm the upgrade

---

## Understanding Your Usage

### Where to Check Usage

1. **Workers & Pages** > **Overview** > **Usage** section
2. Shows requests, CPU time, errors

### What Counts as a Request

Every HTTP request to your worker counts, including:
- Frontend polling (`/state`, `/history`, etc.)
- Telegram webhook calls
- Cron job triggers (every minute = 1,440/day)
- Manual API calls

### Why We Hit Limits

With 10-second polling:
- 6 requests/minute per browser tab
- ~8,640 requests/day per tab just from polling
- Multiple tabs + cron + webhooks = 100k+ easily

---

## Cost Breakdown

### Workers Paid ($5/month)
- First 10M requests: included
- Additional requests: $0.50/million
- CPU time: 50ms included, then $0.02/million ms

### D1 Database (included with Workers)
- 5GB storage: free
- 5M rows read/day: free
- 100k rows written/day: free
- Beyond limits: $0.001/million reads, $1.00/million writes

### For This Project
- **Expected cost:** $5/month flat
- We use far less than included limits
- D1 usage is negligible (<1% of limits)

---

## Billing Cycle

- Charges appear monthly
- Pro-rated if you upgrade mid-cycle
- Cancel anytime (reverts to free tier)

---

## Alternative: Stay on Free Tier

With the polling optimization (RUN-20260115-1142), we can potentially stay on the free tier:

| Scenario | Requests/Day | Under Free Limit? |
|----------|-------------|-------------------|
| Before optimization | ~150,000 | No |
| After optimization (30s polling) | ~50,000 | Yes |
| After optimization (60s polling) | ~25,000 | Yes |
| Single tab + batch mode | ~10,000 | Easily |

**Recommendation:** Implement polling optimization first, then decide if upgrade is needed.

---

## Quick Links

- [Cloudflare Dashboard](https://dash.cloudflare.com)
- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Usage Analytics](https://dash.cloudflare.com/?to=/:account/workers-and-pages) (your account)
