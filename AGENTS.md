# Repository instructions / Instrucciones del repositorio

## English

This repository contains a dependency-free, offline-first OSCP tool reference generated from a verified Kali package inventory.

- Stack: static HTML, CSS and JavaScript; Python only for deterministic data generation; Node.js only for tests.
- Build: `python3 scripts/build_data.py && python3 scripts/build_knowledge.py`
- Test: `./scripts/test.sh`
- Install: `./scripts/install.sh`
- Keep code, comments and identifiers in English.
- Keep user-facing UI and documentation bilingual: English first, Spanish second.
- Do not add telemetry, remote fonts, CDNs or runtime dependencies.
- Keep the app usable through `file://`; do not require a local web server.
- Never include real credentials, private targets, customer data or internal infrastructure details.
- Commands are examples for authorized labs. Use placeholders such as `TARGET`, `DOMAIN`, `USER` and `PASSWORD`.
- Do not replace classic shell commands through aliases.
- Preserve keyboard navigation, reduced-motion support and the readable mode.

## Español

Este repositorio contiene una referencia OSCP sin dependencias y preparada para uso offline, generada desde un inventario verificado de paquetes Kali.

- Stack: HTML, CSS y JavaScript estáticos; Python solo para generar datos de forma determinista; Node.js solo para pruebas.
- Build: `python3 scripts/build_data.py && python3 scripts/build_knowledge.py`
- Prueba: `./scripts/test.sh`
- Instalación: `./scripts/install.sh`
- Mantén código, comentarios e identificadores en inglés.
- Mantén la UI y la documentación bilingües: English primero, Español después.
- No añadas telemetría, fuentes remotas, CDN ni dependencias de runtime.
- La aplicación debe funcionar mediante `file://`; no debe necesitar un servidor local.
- Nunca incluyas credenciales reales, objetivos privados, datos de clientes o detalles internos de infraestructura.
- Los comandos son ejemplos para laboratorios autorizados. Usa placeholders como `TARGET`, `DOMAIN`, `USER` y `PASSWORD`.
- No sustituyas comandos clásicos de shell mediante aliases.
- Conserva navegación por teclado, soporte para movimiento reducido y el modo de lectura.
