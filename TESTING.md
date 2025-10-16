# Global Market - Testing & QA Documentation

## Test Coverage Overview

### 1. Frontend Unit Tests
Location: `src/tests/`

**Implemented Tests:**
- SearchPage component tests
- ProductImport component tests
- Cart flow integration tests

**Running Tests:**
```bash
npm test                 # Run all tests
npm test -- --watch     # Run in watch mode
npm test -- --coverage  # Generate coverage report
```

### 2. Component Testing Checklist

✅ **SearchPage**
- [x] Renders search input
- [x] Displays recent/trending searches
- [x] Shows AI suggestion button
- [x] Clears search query

✅ **ProductImport**
- [x] Renders import form
- [x] Validates required fields
- [x] Handles URL input

⚠️ **TODO: Additional Component Tests**
- [ ] Cart component
- [ ] Checkout flow
- [ ] Product details page
- [ ] Authentication forms
- [ ] Order history

### 3. Integration Testing

**Cart-to-Order Flow:**
- Add items to cart → Checkout → Payment → Order confirmation
- Test database operations
- Test RLS policies

**AI Features:**
- Search suggestions
- Product import from URLs
- Natural language processing

### 4. Security Testing

**Supabase Security Review:**
Run security scan regularly:
```bash
# Security scan is automated via Lovable tools
```

**Key Security Checks:**
- ✅ RLS policies enabled on all tables
- ✅ User authentication required for sensitive operations
- ✅ Payment data handled securely via Stripe
- ✅ No exposed API keys in frontend code

### 5. Performance Testing

**Recommended Tools:**
- Lighthouse (built into Chrome DevTools)
- WebPageTest
- GTmetrix

**Key Metrics to Monitor:**
- First Contentful Paint < 1.8s
- Time to Interactive < 3.8s
- Cumulative Layout Shift < 0.1
- Largest Contentful Paint < 2.5s

### 6. Cross-Browser Testing

**Browsers to Test:**
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Mobile Browsers:**
- Safari iOS
- Chrome Android

**Testing Checklist:**
- [ ] Navigation works across all browsers
- [ ] Forms submit correctly
- [ ] Images load properly
- [ ] Responsive design functions
- [ ] Payment flow works

### 7. Mobile Responsiveness Testing

**Breakpoints:**
- Mobile: 320px - 640px
- Tablet: 641px - 1024px
- Desktop: 1025px+

**Test Using:**
- Chrome DevTools Device Mode
- Real devices (iOS & Android)
- BrowserStack (for comprehensive testing)

**Features to Verify:**
- Touch interactions
- Viewport scaling
- Image optimization
- Navigation menu (burger menu)
- Bottom navigation bar

### 8. API Testing

**Edge Functions:**
```bash
# Test AI Search
curl -X POST https://wvdrsofehwiopbkzrqit.supabase.co/functions/v1/ai-search \
  -H "Content-Type: application/json" \
  -d '{"query": "organic vegetables"}'

# Test Product Import
curl -X POST https://wvdrsofehwiopbkzrqit.supabase.co/functions/v1/import-products \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "storeId": "uuid"}'
```

### 9. Load Testing

**Recommended Tools:**
- Artillery
- k6
- Apache JMeter

**Sample Load Test (using Artillery):**
```yaml
config:
  target: "https://c7e543e8-c5b3-4112-ab05-956ce4a3b079.lovableproject.com"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
      - get:
          url: "/"
      - get:
          url: "/categories"
      - get:
          url: "/search"
```

### 10. Bug Tracking

**Issue Categories:**
- Critical: Blocks main functionality
- High: Important feature broken
- Medium: Minor feature issue
- Low: Cosmetic or nice-to-have

**Tracking Template:**
```
Bug ID: #
Priority: [Critical/High/Medium/Low]
Component: [SearchPage/Cart/Checkout/etc]
Description: 
Steps to Reproduce:
Expected Behavior:
Actual Behavior:
Environment: [Browser, OS, Device]
Status: [Open/In Progress/Fixed/Closed]
```

## QA Report Template

### Test Summary
- Total Tests: X
- Passed: X
- Failed: X
- Coverage: X%

### Critical Issues
1. [List any critical bugs found]

### Security Findings
1. [RLS policy issues]
2. [Authentication vulnerabilities]
3. [Data exposure risks]

### Performance Results
- Lighthouse Score: X/100
- Load Time: Xs
- Bundle Size: XMB

### Recommendations
1. [Priority fixes]
2. [Performance optimizations]
3. [Security enhancements]

## Continuous Testing

**Pre-deployment Checklist:**
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Security scan clean
- [ ] Performance benchmarks met
- [ ] Cross-browser testing complete
- [ ] Mobile responsiveness verified
- [ ] API endpoints tested
- [ ] Database migrations tested

## Testing Best Practices

1. **Write tests for new features** before merging
2. **Run security scans** before deployment
3. **Test on real devices** regularly
4. **Monitor performance** metrics in production
5. **Keep test coverage** above 80%
6. **Document all bugs** with reproduction steps
7. **Test edge cases** and error handling
8. **Validate RLS policies** after schema changes
