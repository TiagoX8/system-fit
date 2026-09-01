"""Gera um par de chaves VAPID (base64url) para o Web Push.

Uso: python generate_vapid.py  -> copie as linhas para o .env
"""

import base64

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat


def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def main() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_bytes = private_key.public_key().public_bytes(
        Encoding.X962, PublicFormat.UncompressedPoint
    )
    private_bytes = private_key.private_numbers().private_value.to_bytes(32, "big")

    print("VAPID_PUBLIC_KEY=" + b64(public_bytes))
    print("VAPID_PRIVATE_KEY=" + b64(private_bytes))


if __name__ == "__main__":
    main()
