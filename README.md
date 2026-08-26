# Finanzas Familia

Sistema financiero de Richard y Raquel. Corre como app web, se instala en el celular
(Android e iPhone) como si fuera una app nativa, y comparte los mismos datos entre los dos
celulares — todo con **GitHub y Netlify solamente**, sin ninguna cuenta ni servicio extra.

---

## 1. Probarlo en tu computadora (opcional)

Necesitás [Node.js](https://nodejs.org) (versión 18 o más nueva).

```bash
npm install
npm run dev
```

**Ojo:** la parte que guarda y sincroniza los datos (`netlify/functions/storage.js`) solo
funciona una vez desplegada en Netlify — `npm run dev` sirve para ver el diseño y navegar la
app, pero el guardado real no va a andar hasta que esté publicada. Si querés probar el
guardado real en tu computadora, instalá la CLI de Netlify (`npm install -g netlify-cli`) y
corré `netlify dev` en vez de `npm run dev`.

---

## 2. Subir a GitHub

```bash
git init
git add .
git commit -m "Finanzas Familia"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/finanzas-familia.git
git push -u origin main
```

---

## 3. Desplegar gratis (Netlify)

1. Andá a **https://app.netlify.com**, iniciá sesión con tu cuenta de GitHub.
2. **Add new site → Import an existing project** → elegí GitHub → seleccioná el repositorio.
3. Netlify detecta la configuración sola (viene en `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
4. **Deploy site**. En 1-2 minutos te da una URL pública.

**No hace falta ninguna cuenta ni configuración extra.** El guardado de datos usa Netlify
Blobs, que viene incluido automáticamente con cualquier sitio de Netlify — ni cuenta nueva,
ni claves para copiar, ni reglas que publicar. Apenas el sitio esté desplegado, ya funciona.

Cada vez que hagas `git push` con cambios, Netlify redespliega solo.

---

## 4. Entrar con código de familia

La primera vez que cada uno abre la app le va a pedir un **código de familia**. Los dos
tienen que escribir **exactamente el mismo código** (mayúsculas/minúsculas importan) — por
ejemplo `richard-raquel-2026`. Guardalo en algún lado (una nota, WhatsApp entre ustedes).

---

## 5. Entrar con PIN

Después del código de familia, cada uno elige quién es (Richard / Raquel) y pone su PIN de
4 dígitos. **Los dos arrancan con el PIN `0000` por defecto** — cámbienlo apenas entren, desde
**Más → Seguridad → Cambiar mi PIN**.

Una vez que entraste en tu celular, no te vuelve a pedir el PIN (queda recordado en ese
dispositivo). Si querés cambiar a la vista de la otra persona desde el mismo celular, el
botón "Sos: Richard" de arriba te deja elegir a Raquel, pero ahí sí te va a pedir **su** PIN.

**Esto no es seguridad bancaria** — evita que se mezclen los datos del otro en el uso normal,
pero no resiste a alguien con conocimientos técnicos. Alcanza para una app familiar entre dos
personas de confianza.

---

## 6. Cómo funciona la sincronización entre celulares

A diferencia de una base de datos en tiempo real, Netlify Blobs es más simple: guardar y
leer, nada más. Para que el otro celular se entere de los cambios, la app **pregunta cada 4
segundos** "¿cambió algo?" y, si cambió, lo aplica solo. No es instantáneo (puede tardar
hasta 4 segundos en aparecer del otro lado), pero funciona sin necesitar ningún servicio
externo.

Al lado de "Sos: [Nombre]" arriba de la app hay un indicador:

- **"Guardando…"** (ámbar) — el cambio se está mandando, todavía no terminó.
- **"Guardado"** (verde) — ya está seguro, se puede cerrar la pestaña.
- **"No se pudo guardar"** (rojo) — algo falló. Tocá el cartel rojo de arriba de todo, que te
  va a decir exactamente qué pasó y qué revisar (sin necesitar la consola del navegador).

Si intentás cerrar la app mientras dice "Guardando…", en computadora te avisa antes de
dejarte salir. En celular, apenas la pantalla se va a segundo plano, la app guarda de
inmediato — no hace falta esperar.

---

## Una limitación real que tenés que conocer (edición simultánea)

Toda la información se guarda como **un solo bloque**. Si Richard y Raquel registran un
movimiento cada uno **en el mismo segundo exacto**, gana el que termine de guardar último —
el otro cambio se pierde, sin aviso. En la práctica es muy poco probable, pero preferí que lo
sepas.

---

## Estructura del proyecto

- `src/App.jsx` — toda la aplicación (dashboard, movimientos, agenda, patrimonio, etc.)
- `src/cloudStorage.js` — conecta la app con la función de guardado (persistencia + sondeo)
- `src/HouseholdGate.jsx` — la pantalla que pide el código de familia la primera vez
- `netlify/functions/storage.js` — la función que guarda y lee los datos (Netlify Blobs)
- `netlify.toml` — le dice a Netlify dónde están el build y las funciones
