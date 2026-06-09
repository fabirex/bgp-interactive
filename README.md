# BGP Interactive Learning Platform

Plataforma educativa interactiva sobre el protocolo BGP (Border Gateway Protocol), construida como una web app estática en HTML/CSS/JS puro — sin frameworks, sin backend, sin dependencias externas excepto Chart.js.

Basada en el libro **"Network Routing: Algorithms, Protocols, and Architectures"** de Deepankar Medhi y Karthikeyan Ramasamy (Morgan Kaufmann), Capítulos 8 y 9.

---

## Demo

Abrí `index.html` directamente en el navegador. No requiere servidor.

---

## Contenido

### `index.html` — Plataforma educativa (9 módulos)

| Módulo | Nivel | Contenido |
|--------|-------|-----------|
| 0 | Básico | ¿Por qué existe BGP? El Internet como grafo de ASes |
| 1 | Básico | Terminología: AS, ASN, prefijos, BGP speaker, PI vs PA |
| 2 | Básico | Sesión BGP, mensajes (OPEN/UPDATE/KEEPALIVE/NOTIFICATION), FSM animada |
| 3 | Básico | eBGP vs iBGP, Reglas 1 y 2, problema full-mesh |
| 4 | Intermedio | Atributos de ruta: AS-PATH, NEXT-HOP, LOCAL-PREF, MED, ORIGIN, COMMUNITY |
| 5 | Intermedio | Algoritmo de decisión BGP — simulador interactivo con sliders |
| 6 | Avanzado | Escalabilidad iBGP: Route Reflectors y Confederations |
| 7 | Avanzado | Route Flap Dampening con gráfico animado (Chart.js) |
| 8 | Avanzado | Playground con topologías precargadas y simulación de fallas |

**Funcionalidades:**
- FSM animada paso a paso (Idle → Established)
- Slider de AS-PATH prepend con efecto en tiempo real
- Slider de LOCAL-PREF con visualización de ruta ganadora
- Simulador de decisión BGP (10 pasos del algoritmo)
- Playground con 3 escenarios: topología básica, principal/backup, Route Reflector
- Tooltips en todos los términos técnicos
- Quiz de 5 preguntas con feedback inmediato
- Barra de progreso por módulos

---

### `playground_v2.html` — Playground manual

Constructor de topologías BGP libre. Permite armar redes desde cero sin configuración previa.

**Funcionalidades:**
- Agregar nodos manualmente (nombre, ASN, tipo, prefijos, LOCAL-PREF)
- Conectar nodos con click (eBGP / iBGP)
- Configurar cada enlace: tipo, AS-PATH prepend, MED, Weight
- Simular el algoritmo de decisión BGP y ver la ruta ganadora en el log
- Simular falla de un nodo y ver el impacto en las sesiones BGP
- Cargar escenario precargado del caso real Claro (Principal/Backup)
- Drag & drop de nodos en el canvas
- Shortcuts de teclado: `N` = nuevo nodo, `Delete` = eliminar, `Esc` = cancelar

---

## Stack

- HTML5 / CSS3 / JavaScript vanilla
- [Chart.js](https://www.chartjs.org/) (CDN) — gráfico de Route Flap Dampening
- SVG nativo para los diagramas de red del playground

---

## Estructura

```
bgp_web/
├── index.html          # Plataforma educativa (9 módulos)
├── playground_v2.html  # Playground manual libre
├── style.css           # Tema oscuro, layout, componentes
└── app.js              # Lógica: FSM, atributos, decisión BGP, playground
```

---

## Uso local

```bash
git clone https://github.com/fabirex/bgp-interactive.git
cd bgp-interactive
# Abrir index.html en el navegador
```

O con servidor local:

```bash
npx serve .
# o
python -m http.server 8080
```

---

## Publicar en GitHub Pages

1. `Settings → Pages`
2. Branch: `master` → `/ (root)`
3. Save

La web queda disponible en `https://fabirex.github.io/bgp-interactive`

---

## Base de conocimiento

El archivo `bgp_knowledge_base.md` (en la carpeta del proyecto, no incluido en el repo) contiene todo el contenido del libro estructurado por módulo con referencias de página. Permite actualizar el contenido sin re-procesar el PDF original.

---

## Referencias

- Medhi, D. & Ramasamy, K. — *Network Routing: Algorithms, Protocols, and Architectures* (Morgan Kaufmann, 2007)
- RFC 4271 — BGP-4
- RFC 1997 — BGP Communities
