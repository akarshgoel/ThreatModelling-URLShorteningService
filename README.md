# ThreatModelling for URLShorteningService

**URL Shortening Service - Requirements:**

**Functional Requirements:**
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

**Traffic Estimation:**
- Assuming, we will have 500M new URL shortenings per month, with 100:1 read/write ratio, we can expect 50B redirections during the same period:
100 * 500M => 50B

- What would be Queries Per Second (QPS) for our system? New URLs shortenings per second:
500 million / (30 days * 24 hours * 3600 seconds) = ~200 URLs/s

- Considering 100:1 read/write ratio, URLs redirections per second will be:
100 * 200 URLs/s = 20K/s

**Storage Estimatation:** 
- Let’s assume we store every URL shortening request (and associated shortened link) for 3 years. Since we expect to have 500M new URLs every month, the total number of objects we expect to store will be 30 billion:
500 million * 3 years * 12 months = 18 billion

- Let’s assume that each stored object will be approximately 500 bytes (just a ballpark estimate–we will dig into it later). We will need 9 TB of total storage:
18 billion * 500 bytes = 9 TB

**Bandwidth Estimattion:** 
- For write requests, since we expect 200 new URLs every second, total incoming data for our service will be 100KB per second:
200 * 500 bytes = 100 KB/s

- For read requests, since every second we expect ~20K URLs redirections, total outgoing data for our service would be 10MB per second:
20K * 500 bytes = ~10 MB/s

**Memory Estimation:** 
- If we want to cache some of the hot URLs that are frequently accessed, how much memory will we need to store them? If we follow the 80-20 rule, meaning 20% of URLs generate 80% of traffic, we would like to cache these 20% hot URLs.

- Since we have 20K requests per second, we will be getting 1.7 billion requests per day:
20K * 3600 seconds * 24 hours = ~1.7 billion

- To cache 20% of these requests, we will need 170GB of memory.
0.2 * 1.7 billion * 500 bytes = ~170GB

- One thing to note here is that since there will be many duplicate requests (of the same URL), our actual memory usage will be less than 170GB.

**Database Setup:**
We need to store billions of records. Each object we store is small (less than 1K). There are no relationships between records—other than storing which user created a URL and the service is read-heavy.

**Database Schema:**
- We would need two tables: one for storing information about the URL mappings and one for the user’s data who created the short link.
- Short URL - PK: Hash: varchar(16)
- long url: varchar(512), creation date & expiration date: datetime, userID: string
- User – PK: UserID: string
- name: varchar(20), email: varchar(32), creationdate: datetime, lastlogin: datetime

**KeyDB:**
- Base64 encoding of url: ([A-Z, a-z, 0-9]) with ‘+’ and ‘/’ , Keylenght: 6 
- Using base64 encoding, a 6 letters long key would result in 64^6 = ~68.7 billion possible strings.

**Storage:**
- 6 (characters per key) * 68.7B (unique keys) = 412 GB
- Services will use offline generated unique keys (using a key generation service - KGS) to read/mark keys in the database. KGS will use two tables to store keys: one for keys that are not used yet, and one for all the used keys to avoid concurrency.
- As soon as KGS gives keys to one of the servers, it can move them to the used keys table. KGS can always keep some keys in memory to quickly provide them whenever a server needs them..

---

**Benefits of Implementing Reverse Proxy (API Gateway)**

- Protect APIs from overuse and abuse via authentication-service and rate limiting
- Suited best for microservices architecure. Easily we can retire/re-create microservices
- Added monitoring and analytical tools to understand user behaviour. (for billing, statisitcs etc)
- Load Balancing
- Cache user context for improved performace
- Handle static web-pages
- Handle 404 requests if user is not subscribed to the shortUrl service. Request will not reach the url service for 404 and other error messages
- Handle error message for expired & invalid shortUrl (url expired & deleted)

---

**Rest APIs**

- Allowed sub-domains: www.accounts.test.com, www.jampage.test.com, www.wikipage.test.com
- long URL: https://www.accounts.test.com/feed/?trk=guest_homepage-basic_nav-header-signin
- Short URL: https://www.accounts.test.com/akarsh-goel-DS2Pdz

REST APIs: 
- postURL(access-token, longUrl, uuid=akarsh-goel, expire_date=default) (3 years) – url shotening service
- Response: JSON formatted – urlCode, longUrl, shortUrl, date, record-id
- deleteURL(access-token, uuid=akarsh-goel, urlCode=DS2Pdz)
- Response: shortUrl & key deleted
- getURL(access-token, uuid=akarsh-goel, urlCode=DS2Pdz)  - url lookup service
- Response: shortUrl is provided/redirected to longUrl
- getExpiredURL(admin access-token, uuid=bob-james) – backend call from interface hosted on API gateway. - cleanup service (admin access only)
- Response: list of exipired URLs  JSON formatted.
- deleteExpiredURL(admin access-token, uuid=bob-james, expired-uuid=akarsh-goel) – backend call from interface hosted on API gateway. (admin access only)
- Response: expired urls deleted manually (if automatic deletion do not happen).

---

**Threat Modelling of URL Shortening Service:**

- DOS attack on External API Endpoints - ensure rate limiting.
- No domain whitelisting for url shortening requests at API gateway level.
- Refresh token (instead of access token) was honored by services (protected resources) - no token hint provided to differentiate the type of tokens.
- Introspect response being cached by the services. Expired urls can be accessed untill unless access token expires - services should subscribe for notification service provided by IDP.
- Flawed redirect_URI validation - redirect_URI sent in authorization code request and token request. - URIs are not pre-registered.
- Flawed scope validation/ scope upgrade - scope sent in authorization code request and token request.
- Stealing authorization code and access tokens – No PKCE configured.
- Spoofing/Flawed CSRF protection for oAuth authorization requests – no state parameter defined with unguessable value.
- Same access token can be used to access more than one services - SSRF (elevation of privileges).
- Admin has access to read introspect response/access token @cache service. - no encryption enabled.
- Admin have full privileges to view shorten/original url user mapping in cache. - cache not encrypted. 
- Admin can overwrite/spoof mappings in db. Admin can spoof unused keys.
- Admin has view/read/write/delete (full) permissions on both the db.
- Concurrency problem - duplicate keys assigned to multiple users – flag not enabled for used keys/ keys failed to mark as used.
- Short-urls assigned with guessable keys – strong encoding algorithm not been used.
- Error messages are not configured properly, sharing more than required information.
- No auditing in place for administrative activities – cleanup service etc.
- HSMs not used for key generation.
- Improper error handling – service information disclosed
- Able to access short-urls/redirect to original urls without authentication.
- Non-scalable services – add virtual/horizontal scallability.
- X-XSS protection, Content security policy, Access-Control-Allow-Origin (CORS)
- Dbs not encrypted. 
- TLS 1.3 not been used ;)


---

**Security Best Practises for URL Shortening Service:**

- Seperate services for url shortening (post/delete) and url lookup should be provided (get request) as get traffic will be much higher than post traffic.
- Cleanup service could only be accessed by admins.
- Keys db could only be accessed by cleanup service & url creation service. 
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
- Secure port should be enabled, subnetting should be in place.
- Ensure auditing & logging is in place for all the sevices specifically for admin activities.
- Apply rate limiting measures at the service level - api gateway.
- Never trust user input.
- Enable input validation for all requests, CSP (XSS protection), CORS (relaxed SOP), CSRF token for application security – Ensure OWASP Top 10.
- Input validation for clean up interface – OWASP top10.
- Scan custom code and open source liberaries. Scan git hubs for sensitive info disclousure.
- Penetration Testing
- GDPR (privacy) assessment









