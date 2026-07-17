import os
import ssl
import certifi

def ensure_trusted_ca_bundle():
    """Merge the Windows trusted-root store into certifi's CA bundle.

    On machines with corporate antivirus/proxy TLS inspection, Windows
    trusts a root CA that certifi's public bundle doesn't ship, so every
    outbound HTTPS call from Python (OpenRouter, DuckDuckGo, Wikipedia)
    fails with CERTIFICATE_VERIFY_FAILED even though the OS itself trusts
    the connection. Exporting the Windows store once into a combined PEM
    file and pointing SSL_CERT_FILE / REQUESTS_CA_BUNDLE at it fixes this
    for every HTTP client in the process (httpx, requests) with no new
    dependencies. No-op on non-Windows or if already configured.
    """
    if os.name != "nt" or os.environ.get("SSL_CERT_FILE"):
        return

    bundle_path = os.path.join(os.path.dirname(__file__), "..", ".ca_bundle.pem")
    bundle_path = os.path.abspath(bundle_path)

    try:
        if not os.path.exists(bundle_path):
            with open(certifi.where(), "rb") as f:
                combined = f.read()

            seen = set()
            extra_certs = []
            for store in ("ROOT", "CA"):
                for cert_der, _encoding, _trust in ssl.enum_certificates(store):
                    if cert_der in seen:
                        continue
                    seen.add(cert_der)
                    extra_certs.append(ssl.DER_cert_to_PEM_cert(cert_der))

            with open(bundle_path, "wb") as f:
                f.write(combined)
                f.write(b"\n")
                f.write("\n".join(extra_certs).encode("ascii"))

        os.environ["SSL_CERT_FILE"] = bundle_path
        os.environ["REQUESTS_CA_BUNDLE"] = bundle_path
    except Exception:
        # Best-effort only — if this fails, calls fall back to the normal
        # certifi bundle and any underlying SSL error surfaces as usual.
        pass
