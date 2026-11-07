# Extra root certificates (optional)

Only needed on networks that intercept TLS, such as antivirus "HTTPS scanning"
(Avast, Kaspersky, ESET...) or a corporate proxy. These re-sign every
certificate with their own root, which Windows/macOS trust but containers
don't. Symptoms: `x509: certificate signed by unknown authority` from the
tunnel, or `unable to get local issuer certificate` from n8n HTTP nodes.

1. Export that root CA as PEM to `n8n/certs/extra-ca.pem` (this file is git-ignored).
2. Set `LENDLOOP_EXTRA_CA_CERT=/extra-certs/extra-ca.pem` in `n8n/.env`.
3. `docker compose up -d` again.
