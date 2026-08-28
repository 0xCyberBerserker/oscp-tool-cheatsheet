# OSCP Tool Cheatsheet

Offline-first searchable reference for the security tools actually installed on a Kali workstation. Search by tool name, audit phase or intent—even with partial names and small typos.

## Features

- Verified live inventory rather than a generic Kali catalog.
- Search in English and Spanish across names, phases, objectives and synonyms.
- Fuzzy matching for forgotten or misspelled program names.
- OSCP-oriented phases: reconnaissance, enumeration, web, exploitation, post-exploitation, privilege escalation, Active Directory, pivoting and more.
- A complete sheet for all 201 tools: purpose, syntax, key options or controls, an operational template, and source provenance.
- Reviewed operational guides are repository-authored; the remaining inventory entries are identified as package references rather than copied documentation.
- Readable mode enabled by default, full keyboard navigation and reduced-motion support.
- Installable PWA with 16 interactive public paths, device-local progress and notes, and verified offline fallback.
- No telemetry, CDN, remote fonts or runtime network requirement.

## Quick start

```bash
./scripts/test.sh
./scripts/install.sh
```

The installer creates application-menu and desktop launchers. The site also works directly through `app/index.html`. When served through HTTPS or localhost, it can be installed as a PWA; the `file://` workflow remains supported.

### Native knowledge paths preview

The Qt 6/QML client reads the versioned packs in `knowledge/`, follows the system
palette and stores progress and local notes in the current user profile:

```bash
./scripts/test-native.sh
./scripts/install-native.sh
```

### CI artifacts

`.github/workflows/build-all.yml` builds separate artifacts for:

- Web PWA.
- Linux x86_64 and ARM64.
- Windows x86_64 portable bundle and MSI.
- Android ARM64 APK, signed with the dedicated project release key only on non-PR `main` builds.
- GitHub OIDC/Sigstore provenance for Linux binaries, the Windows MSI and Android APKs on `main`.

The Web PWA is the only artifact deployed automatically, and only from `main`.
Linux artifacts require a compatible Qt 6.8 runtime.

Release provenance is keyless: GitHub Actions requests a short-lived Sigstore
certificate bound to this repository and workflow. No private signing key is stored.
Verify a downloaded binary, MSI or APK with:

```bash
gh attestation verify ARTIFACT --repo 0xCyberBerserker/oscp-tool-cheatsheet
```

The MSI provenance is not an embedded commercial Authenticode certificate, so Windows
may still display an unknown-publisher warning.

Android release certificate SHA-256 fingerprint:
`08:26:6A:81:B6:E4:4E:80:81:42:CD:9E:2D:BB:D6:3E:7A:EF:16:01:98:25:12:EB:7A:69:BC:3C:FD:45:66:66`.

## Refresh the inventory

Run the inventory collector on the Kali system, copy the JSON file into `data/`, then rebuild:

```bash
python3 scripts/inventory_kali.py /tmp/kali-tools.json
python3 scripts/build_data.py
./scripts/test.sh
```

## Safety

Command examples use placeholders and are intended only for systems and laboratories where testing is explicitly authorized.

---

# Cheatsheet de herramientas OSCP

Referencia buscable y preparada para uso offline de las herramientas de seguridad realmente instaladas en una estación Kali. Permite buscar por programa, fase de auditoría o intención, incluso con nombres incompletos y pequeños errores.

## Funciones

- Inventario vivo verificado, no un catálogo genérico de Kali.
- Búsqueda en English y Español por nombres, fases, objetivos y sinónimos.
- Búsqueda difusa para nombres olvidados o escritos con errores.
- Fases orientadas a OSCP: reconocimiento, enumeración, web, explotación, post-explotación, escalada, Active Directory, pivoting y más.
- Una ficha completa para las 201 herramientas: propósito, sintaxis, opciones o controles clave, plantilla operativa y procedencia.
- Las guías operativas revisadas son contenido propio del repositorio; el resto del inventario se identifica como referencia de paquete y no como documentación copiada.
- Modo de lectura activado por defecto, navegación completa por teclado y movimiento reducido.
- PWA instalable con 16 rutas públicas interactivas, progreso y notas locales al dispositivo y fallback offline verificado.
- Sin telemetría, CDN, fuentes remotas ni necesidad de red durante el uso.

## Inicio rápido

```bash
./scripts/test.sh
./scripts/install.sh
```

El instalador crea accesos en el menú de aplicaciones y en el escritorio. La web también funciona directamente mediante `app/index.html`. Servida mediante HTTPS o localhost, puede instalarse como PWA; el flujo `file://` sigue siendo compatible.

### Vista previa nativa de rutas de conocimiento

El cliente Qt 6/QML lee los paquetes versionados de `knowledge/`, respeta la paleta
del sistema y guarda el progreso y las notas locales en el perfil actual:

```bash
./scripts/test-native.sh
./scripts/install-native.sh
```

### Artefactos de CI

`.github/workflows/build-all.yml` genera artefactos separados para:

- PWA web.
- Linux x86_64 y ARM64.
- Windows x86_64 portable y MSI.
- APK Android ARM64, firmado con la clave de release dedicada solo en builds de `main` ajenas a una PR.
- Procedencia GitHub OIDC/Sigstore para binarios Linux, MSI de Windows y APK de Android en `main`.

La PWA web es el único artefacto que se despliega automáticamente y solo desde `main`.
Los artefactos Linux requieren un runtime Qt 6.8 compatible.

La procedencia de release no usa claves persistentes: GitHub Actions solicita un
certificado Sigstore de vida corta ligado a este repositorio y workflow. No se almacena
ninguna clave privada. Verifica un binario, MSI o APK descargado mediante:

```bash
gh attestation verify ARTEFACTO --repo 0xCyberBerserker/oscp-tool-cheatsheet
```

La procedencia del MSI no es un certificado Authenticode comercial embebido; Windows
puede seguir mostrando el aviso de editor desconocido.

Huella SHA-256 del certificado de release Android:
`08:26:6A:81:B6:E4:4E:80:81:42:CD:9E:2D:BB:D6:3E:7A:EF:16:01:98:25:12:EB:7A:69:BC:3C:FD:45:66:66`.

## Actualizar el inventario

Ejecuta el recolector de inventario en Kali, copia el JSON dentro de `data/` y reconstruye:

```bash
python3 scripts/inventory_kali.py /tmp/kali-tools.json
python3 scripts/build_data.py
./scripts/test.sh
```

## Seguridad

Los comandos usan placeholders y están destinados únicamente a sistemas y laboratorios donde exista autorización explícita.

Made with 🖤 in Barcelona City 🇪🇸
