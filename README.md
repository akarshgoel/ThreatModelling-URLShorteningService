# Threat Modelling for URL Shortening Service


# URL Shortening Service - Requirements:
**Functional Requirements:**
- URL Shortening Service would be created to be used by internal users only, within the organzation network.
- Given a URL, our service should generate a shorter and unique alias of it. This is called a short link (in California, USA ). 
- When users access a short link, our service should redirect them to the original link.
- Short link for limited sub-domains only.
- Clients not subscribed to this service will receive 404 error.
- Links will expire after a standard default timespan. Users should be able to specify the expiration time.
- Cleanup service interface to purge urls not in use/expired.

**Non-Functional Requirements:**
- The system should be highly available. This is required because, if our service is down, all the URL redirections will start failing.
- URL redirection should happen in real-time with minimal latency.
- Shortened links should not be guessable (not predictable).

---

**URL Shortening:**

- Allowed sub-domains: www.accounts.test.com, www.jampage.test.com, www.wikipage.test.com
- long URL: https://www.accounts.test.com/feed/?trk=guest_homepage-basic_nav-header-signin
- Short URL: https://www.accounts.test.com/akarsh-goel-DS2Pdz

**REST APIs:** 
- postURL(access-token, longUrl, uuid=akarsh-goel, expire_date=default) (3 years) – url shortening service
- Response: JSON formatted – urlCode, longUrl, shortUrl, date, record-id
- deleteURL(access-token, uuid=akarsh-goel, urlCode=DS2Pdz)
- Response: shortUrl & key deleted
- getURL(access-token, uuid=akarsh-goel, urlCode=DS2Pdz)  - url lookup service
- Response: shortUrl is provided/redirected to longUrl
- getExpiredURL(admin access-token, uuid=bob-james) – backend call from interface hosted on API gateway. - cleanup service (admin access only)
- Response: list of exipired URLs  JSON formatted.
- deleteExpiredURL(admin access-token, uuid=bob-james, expired-uuid=akarsh-goel) – backend call from interface hosted on API gateway. (admin access only)
- Response: expired urls deleted manually (if automatic deletion do not happen).

**Detailed Requirements can be referred here (source)** - https://www.educative.io/courses/grokking-the-system-design-interview/m2ygV4E81AR

---

# Benefits of Implementing Reverse Proxy (API Gateway)

- Protect APIs from overuse and abuse via authentication-service and rate limiting
- Suited best for microservices architecure. Easily we can retire/re-create microservices
- Added monitoring and analytical tools to understand user behaviour. (for billing, statisitcs etc)
- Load Balancing
- Cache user context for improved performace
- Handle static web-pages
- Handle 404 requests if user is not subscribed to the shortUrl service. Request will not reach the url service for 404 and other error messages
- Handle error message for expired & invalid shortUrl (url expired & deleted)

---

# URL Shortening Service - Threats Identified:

- DOS attack on API Endpoints of URL Shortening Service (Missing rate limiting checks for API endpoints).
- Injection Attacks on API Endpoints (Missing Input Validation checks for API endpoints).
- No domain whitelisting for url shortening requests at API gateway level.
- Flawed redirect_URI validation - Mismatch of redirect_URI, sent in authorization code request and token request (URIs are not pre-registered).
- Stealing authorization code and access tokens (No PKCE configured).
- Concurrency problem - duplicate keys assigned to multiple users – flag not enabled for used keys (keys failed to mark as used).
- Short-urls assigned with guessable keys – strong encoding algorithm not been used.
- Same access token can be used to access more than one services - SSRF (elevation of privileges).
- Flawed scope validation/ scope upgrade - Mismatch of scope, sent in authorization code request and token request.
- Refresh token (instead of access token) being honored by services (protected resources) - no token hint provided to differentiate the type of tokens.
- Introspect/IAM/JSON response being cached by the services. (Expired urls should be accessed untill unless access token expires - services should subscribe for notification service provided by IDP, to reject un-authorized shorten URL requests or expired shorten URL requests.)
- Spoofing/Flawed CSRF protection for oAuth authorization requests – no state parameter defined with unguessable value.
- Admin has access to read introspect response/access token @cache service. - no encryption enabled.
- Admin have full privileges to view shorten/original url user mapping in cache. - cache not encrypted. 
- Admin can overwrite/spoof URL mappings in db. Admin can assign spoofed or his/her own desired keys to Shorten URL requests. 
- Admin can spoof unused keys (generated and stored in key generation DB, to be assigned to new shorten URLs).
- Admin has view/read/write/delete (full) permissions on both the db.
- Error messages are not configured properly, sharing more than required information.
- No auditing in place for administrative activities – cleanup service etc.
- HSMs not used for key generation.
- Improper error handling – service information disclosed
- Able to access short-urls/redirect to original urls without authentication ( Org Portal - service is for internal users only).
- UI portal - Web UI threats like no input validation, session hijacking/cookies management, encoding of data (OWASP Top 10)
- Non-scalable services – add virtual/horizontal scallability.
- X-XSS protection Content security policy, Access-Control-Allow-Origin not configured (CORS).
- Both the Dbs (URL Shortening DB & Generated Key Storage DB) are not encrypted. 
- TLS 1.3 not been used ;)


---

# URL Shortening Service - Security Best Practises:

- Seperate services for url shortening (post/delete) and url lookup (get request), should be provided as get traffic will be much higher than post traffic.
- Cleanup service should only be accessed by admins.
- Keysdb should only be accessed by cleanup service & url creation service. 
- All requests will hit API Gateway only. API gateway (reverse proxy) will redirect request to Shorten URL service/url lookup service/cleanup service after successful IAM authentication & provide security context with fine grained access control.
- API gateway should not have direct access to Dbs.
- After users/clients are successfully authenticated from organization’s IAM solution, all the clients should have fine grained access control with minimum required permissions to access only defined & configured business applications.
- Respective db services should be accessed by defined and configured services only (zero trust architecture).
- All the clients should be re-authenticated & therefore re-authorized, if they need to access any of additional business services/applications other than the approved access.
- Applications should not trust clients/users.
- Applications should not trust peer applications.
- Based on business requirements, if authentication & authorization response granted by Org. IAM is cached by applications (to increase application efficiency), applications should cache it for a short duration of time & adopt encryption methods.
- Services should be configured to serve business logic only. No additional configurations/integrations should be enabled.
- TLS 1.3 (ssl offloading only if needed) - api gateway
- Do not enable non required API request methods. API Methods like Trace, which are not needed here should be kept disabled.
- Secure port should be enabled, subnetting should be in place.
- Ensure auditing & logging is in place for all the sevices specifically for admin activities.
- Apply rate limiting measures at the service level - api gateway.
- Never trust user input. Implement Input Validation techniques.
- Enable input validation for all requests, CSP (XSS protection), CORS (relaxed SOP), CSRF token for application security – Ensure OWASP Top 10.
- Input validation for clean up interface – OWASP top10.
- Scan custom code and open source liberaries. Scan git hubs for sensitive info disclousure.
- Perform Penetration Testing
- Perform GDPR (privacy) assessment









