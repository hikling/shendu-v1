# Official evidence checked 2026-11-17

https://developers.cloudflare.com/r2/api/s3/api/ lists SHA256 FULL_OBJECT unsupported, COMPOSITE supported. Current single-part SHA256-in-HEAD assumption is not a portable R2 requirement. Bounded actual-byte verification preserves integrity.

https://developers.cloudflare.com/r2/api/s3/presigned-urls/ supports presigned API-domain requests, not custom domains.

https://developers.cloudflare.com/r2/buckets/cors/ requires exact browser origin, allowed methods and custom headers even if server requests work. User origin https://8888864.xyz. CORS example includes GET/PUT/HEAD, Content-Type,x-amz-meta-sha256,x-amz-checksum-sha256 for upgrade compatibility. Private bucket remains private. Production cause still unconfirmed.
