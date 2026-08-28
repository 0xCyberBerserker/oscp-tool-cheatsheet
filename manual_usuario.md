# User manual / Manual de usuario

## English

### Search

Open **OSCP Tool Cheatsheet** from the application menu or desktop. Search using:

- a program name: `nmap`, `ferox`, `evil winrm`;
- an audit phase: `reconnaissance`, `post-exploitation`, `pivoting`;
- an intent: `scan ports`, `web directories`, `Linux privilege escalation`.

Small typing errors are accepted. Press `Ctrl+K` or `/` to focus search and `Esc` to clear it.

### Filters and recipes

Select a phase in the left navigation. Enable **Detailed recipes only** to show tools with curated OSCP commands. Every other tool includes its verified launcher or help invocation. Expand a tool row and copy the required command. Replace uppercase placeholders before running it.

When an enhanced workflow command has a direct classic Linux fallback, both are shown. Specialized security tools are not given misleading shell substitutes.

### Interactive paths and notes

Open **Interactive paths**, choose a path and select any node in its visual roadmap. Completion is stored per path and step. Notes are stored per path and step after pressing **Save note**; switching steps also preserves the current draft. This data belongs to the current browser profile, is not encrypted or synchronized, and must not contain secrets.

### Readability

The monospaced mode is enabled by default. `Aa · Mono` toggles a local monospace font stack and wider spacing. The sun/moon button changes theme and `EN/ES` changes language. Preferences remain in the local browser profile.

### Troubleshooting

- Empty result: use a broader intent or clear the phase filter.
- A command differs from current syntax: open its official Kali reference.
- Launcher missing: run `./scripts/install.sh` again.

## Español

### Búsqueda

Abre **Cheatsheet de herramientas OSCP** desde el menú de aplicaciones o el escritorio. Puedes buscar mediante:

- nombre del programa: `nmap`, `ferox`, `evil winrm`;
- fase de auditoría: `reconocimiento`, `post-explotación`, `pivoting`;
- intención: `escanear puertos`, `directorios web`, `escalar privilegios Linux`.

Se toleran pequeños errores de escritura. Pulsa `Ctrl+K` o `/` para enfocar la búsqueda y `Esc` para limpiarla.

### Filtros y recetas

Selecciona una fase en la navegación lateral. Activa **Solo recetas detalladas** para mostrar herramientas con comandos OSCP revisados. El resto incluye su invocación verificada de launcher o ayuda. Despliega una herramienta y copia el comando necesario. Sustituye los placeholders en mayúsculas antes de ejecutarlo.

Cuando un comando de flujo mejorado tiene una alternativa clásica directa de Linux, se muestran ambos. No se inventan sustitutos de shell engañosos para herramientas de seguridad especializadas.

### Rutas interactivas y notas

Abre **Rutas interactivas**, elige una ruta y selecciona cualquier nodo del roadmap visual. El progreso se guarda por ruta y paso. Las notas se guardan por ruta y paso al pulsar **Guardar nota**; cambiar de paso también conserva el borrador actual. Los datos pertenecen al perfil actual del navegador, no están cifrados ni sincronizados y no deben contener secretos.

### Legibilidad

El modo monoespaciado está activado por defecto. `Aa · Mono` alterna una pila de fuentes monoespaciadas locales y un espaciado mayor. El botón de sol/luna cambia el tema y `EN/ES` cambia el idioma. Las preferencias permanecen en el perfil local del navegador.

### Resolución de problemas

- Sin resultados: usa una intención más general o limpia el filtro de fase.
- La sintaxis actual ha cambiado: abre la referencia oficial de Kali.
- Falta el launcher: ejecuta de nuevo `./scripts/install.sh`.
