# Finanzas Familia

Sistema financiero de Richard y Raquel. Corre como app web, se instala en el celular
(Android e iPhone) como si fuera una app nativa, y sincroniza en vivo entre los dos
celulares usando Firebase.

---

## 1. Crear el proyecto de Firebase (una sola vez, ~5 minutos)

1. Andá a **https://console.firebase.google.com** e iniciá sesión con una cuenta de Google.
2. **Crear proyecto** → ponele un nombre (ej: `finanzas-familia`) → seguí los pasos (podés
   desactivar Google Analytics, no hace falta).
3. Adentro del proyecto, en el menú izquierdo: **Compilación → Firestore Database** →
   **Crear base de datos** → elegí una ubicación cercana (ej: `southamerica-east1`) →
   modo **producción**.
4. Andá a **Firestore Database → Reglas** y pegá el contenido del archivo
   [`firestore.rules`](./firestore.rules) de este repo. Publicá.
5. Volvé a la página principal del proyecto (ícono de engranaje ⚙️ → **Configuración del
   proyecto**). Abajo, en "Tus apps", tocá el ícono **</>** (Web) para agregar una app web.
   Ponele un nombre (ej: `finanzas-web`) y **no** actives Firebase Hosting.
6. Firebase te va a mostrar un bloque de código con `firebaseConfig = { apiKey: ..., ... }`.
   Copiá esos valores.
7. Abrí `src/firebase.js` en este proyecto y pegá cada valor en su lugar (reemplazando los
   textos `PEGA_ACA_...`).

Listo, ya tenés tu base de datos propia y gratuita.

---

## 2. Probarlo en tu computadora (opcional pero recomendado)

Necesitás tener [Node.js](https://nodejs.org) instalado (versión 18 o más nueva).

```bash
npm install
npm run dev
```

Abrí la URL que te muestra la terminal (algo como `http://localhost:5173`). La primera vez
te va a pedir un **código de familia** — poné cualquier texto único (ej: `richard-raquel-2026`)
y quedará guardado en ese navegador.

---

## 3. Subir a GitHub

```bash
git init
git add .
git commit -m "Finanzas Familia"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/finanzas-familia.git
git push -u origin main
```

**Importante:** `src/firebase.js` va a quedar público en el repo con tus claves de Firebase.
Esto es normal y seguro para este tipo de configuración (son claves públicas, pensadas para
vivir en el navegador) — lo que protege tus datos son las **reglas de Firestore** del paso 1,
no ocultar esas claves. Si preferís no subirlas nunca a un repo público, hacé el repositorio
**privado** en GitHub (gratis).

---

## 4. Desplegarlo gratis (Netlify)

Como ya usaste Netlify para Esplendido, es el mismo flujo:

1. Andá a **https://app.netlify.com**, iniciá sesión con tu cuenta de GitHub.
2. **Add new site → Import an existing project** → elegí GitHub → seleccioná el repositorio `finanzas-familia`.
3. Netlify va a detectar Vite solo, pero confirmá que diga:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. **Deploy site**. En 1-2 minutos te da una URL pública, algo como `finanzas-familia.netlify.app`
   (se lo podés cambiar por un nombre más lindo en **Site configuration → Change site name**).

Esa URL es la que van a abrir Richard y Raquel desde sus celulares.

**Nota:** cada vez que hagas `git push` a GitHub con cambios, Netlify vuelve a desplegar solo —
no hace falta subir nada a mano, igual que con Esplendido.

---

## 5. Instalarlo en el celular como una app

**Android (Chrome):** abrí la URL → menú (⋮) → **Agregar a pantalla de inicio**.

**iPhone (Safari):** abrí la URL → botón de compartir (⬆️) → **Agregar a pantalla de inicio**.

Va a quedar como un ícono más, a pantalla completa, sin la barra del navegador.

---

## 6. Conectar los dos celulares

La primera vez que cada uno abre la app le va a pedir un **código de familia**. Los dos
tienen que escribir **exactamente el mismo código** (mayúsculas/minúsculas importan). A
partir de ahí, cualquier cambio que haga uno aparece solo en el celular del otro, sin
recargar la página.

Si en algún momento quieren usar la app en un celular nuevo, solo hace falta instalarla y
poner el mismo código de familia — los datos ya están en la nube, no en el celular.

---

## 7. Entrar con PIN

Después del código de familia, cada uno elige quién es (Richard / Raquel) y pone su PIN de
4 dígitos. **Los dos arrancan con el PIN `0000` por defecto** — cámbienlo apenas entren, desde
**Más → Seguridad → Cambiar mi PIN**.

Una vez que entraste en tu celular, no te vuelve a pedir el PIN (queda recordado en ese
dispositivo). Si querés cambiar a la vista de la otra persona desde el mismo celular —por
ejemplo, Richard quiere ver su parte sin que Raquel tenga que prestarle el suyo— el botón
"Sos: Richard" de arriba te deja elegir a Raquel, pero ahí sí te va a pedir **su** PIN. Así
cada uno mantiene su información personal separada, incluso compartiendo el mismo celular
en algún momento.

**Importante — esto no es seguridad bancaria.** El PIN evita que se mezclen o vean por error
los datos del otro en el uso normal, pero no está pensado para resistir a alguien con
conocimientos técnicos que abra las herramientas de desarrollador del navegador. Para una
app financiera familiar entre dos personas de confianza, alcanza; si más adelante quieren
algo más robusto, se puede sumar Firebase Authentication (login real con contraseña).

---

## Si la app tarda en cargar o algo no se sincroniza

Si algo falla con la conexión a la base de datos (Firebase mal configurado, sin
conexión, reglas mal publicadas), va a aparecer un **cartel rojo arriba de todo** explicando
qué pasó, en vez de fallar en silencio. Si lo ves, revisá:

1. Que `src/firebase.js` tenga tus claves reales, no los `PEGA_ACA_...` de ejemplo.
2. Que hayas publicado las reglas de `firestore.rules` en la consola de Firebase.
3. Que ambos celulares usen exactamente el mismo código de familia (paso 6).

---

## Estructura del proyecto

- `src/App.jsx` — toda la aplicación (dashboard, movimientos, agenda, patrimonio, etc.)
- `src/firebase.js` — configuración de tu proyecto de Firebase (pegar acá tus claves)
- `src/cloudStorage.js` — conecta la app con Firestore (guardado + sincronización en vivo + aviso de errores)
- `src/HouseholdGate.jsx` — la pantalla que pide el código de familia la primera vez
- `firestore.rules` — reglas de seguridad de la base de datos

## Notas

- No hay login con usuario/contraseña — la privacidad depende de que el código de familia
  no se comparta. Si más adelante quieren agregar login real (email + contraseña), es un
  cambio chico sobre esta misma base con Firebase Authentication.
- El plan gratuito de Firebase (Spark) alcanza de sobra para el uso de una familia.
