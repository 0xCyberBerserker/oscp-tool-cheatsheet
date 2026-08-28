# Encrypted profiles security model / Modelo de seguridad de perfiles cifrados

## English

GitHub proves account identity; it never derives or unlocks encryption keys. After each
login, the Worker resolves GitHub's numeric user ID, derives a stable opaque subject with
HMAC-SHA-256 and a Worker secret, then discards the GitHub token. D1 never stores the raw
GitHub ID, login, email or access token.

Each browser profile creates a random 256-bit data-encryption key. A separate user
passphrase derives a key with PBKDF2-HMAC-SHA-256 at 600,000 iterations and a random
256-bit salt. That key wraps the data key with AES-256-GCM. Every private record uses
AES-256-GCM, a fresh random 96-bit IV and authenticated context containing the account,
vault ID, record ID and revision. IndexedDB and D1 receive envelopes and ciphertext only; the
unwrapped data key exists only in memory while the profile is unlocked.

This is server-blind client-side encryption, not perfect zero knowledge. A compromised
PWA origin or malicious service worker can capture plaintext while unlocked. D1 still
reveals opaque account linkage, record sizes, revisions and access timing. Deletion and
rollback by the service remain possible.

Current limits:

- PBKDF2 is the dependency-free Web Crypto baseline. Audited, offline-packaged Argon2id
  remains required before describing the KDF as memory-hard.
- The encrypted local snapshot is the durable single-record sync outbox. Recovery keys,
  automatic multi-device conflict resolution and native Qt encryption are not implemented yet.
- The GitHub Pages demo is not a suitable private-data origin. Encrypted profiles use the
  isolated production origin serving both PWA and Worker routes.
- Losing the passphrase currently loses access permanently.

## Español

GitHub demuestra la identidad de la cuenta; nunca deriva ni desbloquea las claves de
cifrado. Después de cada login, el Worker resuelve el ID numérico de GitHub, deriva un
sujeto opaco estable mediante HMAC-SHA-256 y un secreto del Worker, y descarta el token.
D1 nunca guarda el ID real, login, email ni token de acceso de GitHub.

Cada perfil del navegador crea una clave de datos aleatoria de 256 bits. Una frase de
cifrado independiente deriva una clave con PBKDF2-HMAC-SHA-256, 600.000 iteraciones y
salt aleatorio de 256 bits. Esa clave envuelve la clave de datos mediante AES-256-GCM.
Cada registro privado usa AES-256-GCM, IV aleatorio nuevo de 96 bits y contexto
autenticado con cuenta, identificador de bóveda, registro y revisión. IndexedDB y D1 solo reciben sobres y texto
cifrado; la clave de datos abierta solo vive en memoria mientras el perfil está abierto.

Es cifrado en cliente ciego para el servidor, no conocimiento cero perfecto. Un origen
PWA o service worker comprometido puede capturar texto claro mientras el perfil está
abierto. D1 aún revela la relación entre sujetos opacos, tamaños, revisiones y tiempos de
acceso. El servicio todavía puede borrar datos o presentar versiones antiguas.

Límites actuales:

- PBKDF2 es la base sin dependencias disponible en Web Crypto. Falta integrar Argon2id
  auditado y empaquetado offline antes de llamar memory-hard a la KDF.
- El snapshot local cifrado funciona como outbox duradero de un único registro. Aún faltan
  recovery key, resolución automática de conflictos multidispositivo y cifrado de la aplicación Qt nativa.
- La demo de GitHub Pages no es un origen adecuado para datos privados. Los perfiles
  cifrados usan el origen de producción aislado que sirve la PWA y las rutas del Worker.
- Perder la frase de cifrado implica actualmente perder el acceso para siempre.
