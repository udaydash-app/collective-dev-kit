# Global Market - Production Deployment Guide

## 🚀 Deployment Checklist

### Pre-Deployment Steps

#### 1. **Code Quality & Testing**
- [x] All tests passing (`npm test`)
- [x] Security scan completed with no critical issues
- [x] Performance benchmarks met (Lighthouse score > 90)
- [x] Cross-browser testing completed
- [x] Mobile responsiveness verified

#### 2. **Database & Backend**
- [x] All migrations applied successfully
- [x] RLS policies tested and secure
- [x] Edge functions deployed and tested
- [x] Backup strategy in place

#### 3. **Environment Configuration**
- [ ] Production environment variables set
- [ ] API keys secured (Stripe, Resend, Lovable AI)
- [ ] Domain configured
- [ ] SSL certificate active

## 📦 Deploying to Production

### Step 1: Publish Your App

1. **Click the "Publish" button** in the top-right corner of Lovable
2. Your app will be deployed to: `https://c7e543e8-c5b3-4112-ab05-956ce4a3b079.lovableproject.com`
3. Wait for deployment to complete (usually 1-2 minutes)

### Step 2: Configure Custom Domain

1. **Go to Project Settings → Domains**
2. Click **"Connect Domain"**
3. Enter your domain name (e.g., `globalgrocery.com`)
4. Follow the DNS configuration instructions:

```
A Record Configuration:
- Type: A
- Name: @ (for root domain)
- Value: 185.158.133.1

A Record for www:
- Type: A  
- Name: www
- Value: 185.158.133.1
```

5. Wait for DNS propagation (up to 24-48 hours)
6. SSL will be automatically provisioned by Lovable

**Troubleshooting Domain Issues:**
- Use [DNSChecker.org](https://dnschecker.org) to verify DNS settings
- Ensure no conflicting DNS records exist
- Remove old records from previous hosts
- If using CAA records, allow Let's Encrypt for SSL

### Step 3: Set Up Email Notifications

1. **Create Resend Account**
   - Go to [resend.com](https://resend.com)
   - Sign up and verify your account
   - Add and verify your domain at [resend.com/domains](https://resend.com/domains)

2. **Generate API Key**
   - Go to [resend.com/api-keys](https://resend.com/api-keys)
   - Create a new API key
   - Copy the key

3. **Add to Supabase Secrets**
   - Go to [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/wvdrsofehwiopbkzrqit/settings/functions)
   - Add `RESEND_API_KEY` with your key

4. **Update Email Template**
   - Edit `supabase/functions/send-order-confirmation/index.ts`
   - Change `from: "Global Market <orders@yourdomain.com>"` to your verified domain

### Step 4: Configure Supabase Production Settings

1. **Review Authentication Settings**
   - Go to [Supabase Auth Settings](https://supabase.com/dashboard/project/wvdrsofehwiopbkzrqit/auth/providers)
   - Set Site URL to your production domain
   - Add production domain to Redirect URLs

2. **Enable Email Templates**
   - Configure confirmation, reset password, and magic link emails
   - Use your custom domain for email links

3. **Set Up Database Backups**
   - Enable daily automated backups
   - Download manual backup before major changes

4. **Review RLS Policies**
   - All sensitive tables protected ✅
   - Anonymous access explicitly denied ✅
   - User-specific data properly isolated ✅

## 🔐 Security Configuration

### Stripe Production Mode

1. **Switch to Live Keys**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com)
   - Copy your **Live Secret Key**
   - Update Supabase secret: `STRIPE_SECRET_KEY`
   - Copy your **Live Publishable Key**
   - Update in code if needed

2. **Enable Webhooks**
   - Create webhook endpoint for production domain
   - Subscribe to relevant events (payment_intent.succeeded, etc.)

### API Rate Limits

- **Lovable AI**: Monitor usage at Settings → Workspace → Usage
- **Supabase**: Review rate limits for your plan
- **Stripe**: Configure rate limits in dashboard

## 📊 Monitoring & Analytics

### Application Monitoring

1. **Supabase Logs**
   - [Database Logs](https://supabase.com/dashboard/project/wvdrsofehwiopbkzrqit/logs/postgres-logs)
   - [Edge Function Logs](https://supabase.com/dashboard/project/wvdrsofehwiopbkzrqit/functions)
   - [Auth Logs](https://supabase.com/dashboard/project/wvdrsofehwiopbkzrqit/auth/users)

2. **Performance Monitoring**
   ```bash
   # Run Lighthouse audit
   npm install -g lighthouse
   lighthouse https://yourdomain.com --view
   ```

3. **Error Tracking**
   - Monitor console errors in production
   - Set up Sentry or similar (optional)

### Key Metrics to Track

- **Orders per day/week/month**
- **Conversion rate** (visitors → orders)
- **Average order value**
- **Popular products**
- **Cart abandonment rate**
- **Peak traffic times**
- **User retention**

## 📱 PWA Configuration

Your app is already configured as a PWA! Users can:

1. **On Mobile (iOS/Android)**
   - Visit your site in Safari/Chrome
   - Tap "Share" → "Add to Home Screen"
   - Icon appears on home screen

2. **On Desktop**
   - Visit your site in Chrome
   - Look for install prompt
   - Click "Install" in address bar

**PWA Features Enabled:**
- ✅ Offline support
- ✅ App-like experience
- ✅ Fast loading
- ✅ Push notifications ready

## 👥 Store Onboarding Process

### Admin Dashboard Access
- Navigate to `/admin/dashboard` (create admin role system first)
- Import products via `/admin/import-products`

### Adding New Stores

1. **Add Store to Database**
```sql
INSERT INTO stores (name, address, city, state, zip_code, phone, is_active)
VALUES (
  'Fresh Foods Market',
  '123 Main St',
  'San Francisco',
  'CA',
  '94102',
  '(555) 123-4567',
  true
);
```

2. **Import Products**
   - Use admin product import tool
   - Provide store's product page URL
   - AI will extract and categorize products

3. **Test Store Integration**
   - Verify products appear correctly
   - Test ordering flow
   - Confirm delivery zones

## 🚨 Post-Launch Monitoring

### Week 1 Checklist

- [ ] Monitor error rates daily
- [ ] Check order completion rates
- [ ] Review user feedback
- [ ] Verify email notifications working
- [ ] Test payment processing
- [ ] Monitor page load times
- [ ] Check mobile experience

### Ongoing Maintenance

- **Daily**: Check error logs, monitor orders
- **Weekly**: Review analytics, customer feedback
- **Monthly**: Security audit, performance review
- **Quarterly**: Major feature updates, scaling review

## 📞 Support & Troubleshooting

### Common Issues

**Orders not processing:**
- Check Stripe webhook configuration
- Verify RLS policies allow order creation
- Review edge function logs

**Emails not sending:**
- Verify Resend API key is set
- Check domain verification in Resend
- Review email template configuration

**Slow performance:**
- Run Lighthouse audit
- Optimize images
- Review database query performance
- Enable caching where appropriate

### Getting Help

- **Lovable Support**: [Discord Community](https://discord.com/channels/1119885301872070706/1280461670979993613)
- **Lovable Docs**: [docs.lovable.dev](https://docs.lovable.dev/)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Stripe Support**: [stripe.com/docs](https://stripe.com/docs)

## 🎉 Launch Announcement

Once everything is tested and ready:

1. **Announce on social media**
2. **Email early users/beta testers**
3. **Update marketing materials with live URL**
4. **Monitor closely for first 48 hours**
5. **Gather user feedback**
6. **Iterate based on real usage data**

## 📈 Scaling Considerations

As your app grows:

- **Database**: Upgrade Supabase plan for more connections
- **Edge Functions**: Monitor execution time and frequency
- **Storage**: Plan for product image storage growth
- **AI Credits**: Top up Lovable AI credits as usage increases
- **Stripe**: Review pricing tier as transaction volume grows

---

## Quick Links

- 🌐 **Production App**: https://c7e543e8-c5b3-4112-ab05-956ce4a3b079.lovableproject.com
- 🗄️ **Supabase Dashboard**: https://supabase.com/dashboard/project/wvdrsofehwiopbkzrqit
- 💳 **Stripe Dashboard**: https://dashboard.stripe.com
- 📧 **Resend Dashboard**: https://resend.com/domains
- 🤖 **Lovable AI Usage**: Settings → Workspace → Usage

**You're ready to launch! 🚀**
