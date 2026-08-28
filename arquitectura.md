# Architecture / Arquitectura

## English

The application is a static, offline-first document. Build scripts transform a verified Kali inventory and curated guidance into a single browser-ready data file.

```mermaid
flowchart LR
    Kali["Installed Kali packages"] --> Inventory["inventory_kali.py"]
    Inventory --> Raw["kali-tools.json"]
    Guides["Maintained OSCP guides"] --> Builder["build_data.py"]
    Guides --> Knowledge["build_knowledge.py"]
    Raw --> Builder
    Builder --> Data["app/data.js"]
    Knowledge --> Pack["app/knowledge.js"]
    Data --> UI["Offline browser UI"]
    Pack --> UI
    Worker["Service worker"] --> UI
```

- `data/`: source inventory and repository-maintained recipes.
- `scripts/`: deterministic inventory, build, test and install commands.
- `app/`: runtime HTML, CSS, JavaScript and generated data.
- `tests/`: dependency-free structural and search checks.
- `packaging/`: freedesktop launcher.

Trust boundary: inventory data and recipes are build inputs. Rendering uses text nodes rather than interpreting data as HTML. The runtime makes no automatic network requests; official references open only after user action.

The browser client remains usable through `file://`. Over HTTPS or localhost, its
service worker caches only same-origin public assets. Progress and notes use local
browser storage and are never part of generated packs or deployment artifacts.

The portable knowledge-path contract lives in `knowledge/`. It is UI-agnostic and
separates reviewed content from device-local progress. `native/` contains the Qt 6/QML
reader for Linux and the portable base for later Windows and Android builds. It embeds
only reviewed public packs and stores progress through local Qt settings. Control Center
may consume the same pack through an adapter, but operational lab controls remain
outside the standalone product.

Personal writeups, private vaults and infrastructure-specific integrations are outside
this public repository. They belong only in a separate private Control Center adapter.

The single CI workflow validates sources, emits separate Web, Linux, Windows and Android
artifacts, and deploys only the Web PWA from `main`. Android CI packages are intentionally
not release-signed; signing material remains outside the repository.

## Español

La aplicación es un documento estático y preparado para uso offline. Los scripts de build transforman un inventario verificado de Kali y una guía revisada en un único archivo de datos listo para navegador.

- `data/`: inventario fuente y recetas mantenidas por el repositorio.
- `scripts/`: comandos deterministas de inventario, build, prueba e instalación.
- `app/`: HTML, CSS, JavaScript y datos generados para runtime.
- `tests/`: comprobaciones estructurales y de búsqueda sin dependencias.
- `packaging/`: launcher freedesktop.

Límite de confianza: el inventario y las recetas son entradas del build. El renderizado utiliza nodos de texto y no interpreta los datos como HTML. El runtime no realiza peticiones automáticas de red; las referencias oficiales solo se abren por acción del usuario.

El cliente web sigue funcionando mediante `file://`. Bajo HTTPS o localhost, su
service worker guarda únicamente recursos públicos del mismo origen. El progreso y las
notas usan almacenamiento local del navegador y nunca forman parte de los paquetes
generados ni de los artefactos desplegados.

El contrato portable de rutas de conocimiento vive en `knowledge/`. Es independiente de
la UI y separa el contenido revisado del progreso local de cada dispositivo. `native/`
contiene el lector Qt 6/QML para Linux y la base portable de compilaciones posteriores
para Windows y Android. Solo embebe paquetes públicos revisados y guarda el progreso
mediante ajustes locales de Qt. Control Center podrá consumir el mismo paquete mediante
un adaptador, pero los controles operativos del laboratorio quedarán fuera del producto
standalone.

Los writeups personales, las bóvedas privadas y las integraciones específicas de una
infraestructura están fuera de este repositorio público. Solo pertenecerán a un adaptador
privado e independiente de Control Center.

El workflow único de CI valida las fuentes, genera artefactos separados para Web, Linux,
Windows y Android y solo despliega la PWA web desde `main`. Los paquetes Android de CI no
están firmados para release; el material de firma permanece fuera del repositorio.
