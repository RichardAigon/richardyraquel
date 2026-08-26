// Reemplaza a window.storage (que solo existe adentro de Claude) por la función
// de Netlify en netlify/functions/storage.js, respaldada por Netlify Blobs — el
// almacenamiento propio de Netlify. No hace falta ninguna cuenta ni configuración
// externa: funciona solo en cuanto el sitio está desplegado en Netlify.
//
// Mantiene la MISMA forma que usa App.jsx (get/set con {key, value}), así que
// el motor financiero no necesitó ningún cambio.

const HOUSEHOLD_KEY = "ff-household-id";
const API_PATH = "/api/storage";

// Última versión conocida del dato, por clave. Se usa para: (a) detectar si un
// valor recibido por sondeo es realmente nuevo antes de aplicarlo, y (b) evitar
// procesar nuestro propio guardado como si fuera un cambio remoto.
const lastKnownValue = {};

function reportStatus(source, status, message) {
  window.dispatchEvent(new CustomEvent("cloudstorage-status", { detail: { source, status, message } }));
}

// Traduce errores de red/HTTP a instrucciones concretas, para no depender de que
// la persona sepa leer la consola del navegador.
function friendlyErrorMessage(e, action) {
  const msg = String(e && e.message ? e.message : e);
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network")) {
    return `No se pudo ${action}: sin conexión a internet. La app va a reintentar sola cuando vuelva.`;
  }
  if (msg.includes("404")) {
    return `No se pudo ${action}: la función de guardado no está desplegada todavía. Esperá 1-2 minutos después de subir los cambios a GitHub y volvé a intentar.`;
  }
  if (msg.includes("500")) {
    return `No se pudo ${action}: hubo un error en el servidor de Netlify. Probá de nuevo en unos segundos.`;
  }
  return `No se pudo ${action}: ${msg}`;
}

export function getHouseholdId() {
  return localStorage.getItem(HOUSEHOLD_KEY);
}

export function setHouseholdId(id) {
  localStorage.setItem(HOUSEHOLD_KEY, id.trim());
}

function apiUrl(key) {
  const hh = getHouseholdId();
  return `${API_PATH}?household=${encodeURIComponent(hh)}&key=${encodeURIComponent(key)}`;
}

// Se instala como window.storage para que App.jsx funcione sin modificaciones.
export function installCloudStorage() {
  window.storage = {
    async get(key) {
      const hh = getHouseholdId();
      if (!hh) return null;
      try {
        const res = await fetch(apiUrl(key));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        reportStatus("storage", "ok");
        if (data.value === null || data.value === undefined) return null;
        lastKnownValue[key] = data.value;
        return { key, value: data.value, shared: false };
      } catch (e) {
        console.error("cloudStorage.get error:", e);
        reportStatus("storage", "error", friendlyErrorMessage(e, "leer los datos"));
        return null;
      }
    },
    async set(key, value) {
      const hh = getHouseholdId();
      if (!hh) return null;
      try {
        const res = await fetch(apiUrl(key), { method: "POST", body: value });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        lastKnownValue[key] = value;
        reportStatus("storage", "ok");
        return { key, value, shared: false };
      } catch (e) {
        console.error("cloudStorage.set error:", e);
        reportStatus("storage", "error", friendlyErrorMessage(e, "guardar"));
        return null;
      }
    },
    async delete() {
      return null; // no usado por la app actualmente
    },
    async list() {
      return null; // no usado por la app actualmente
    },
  };
}

// Sincronización entre celulares: acá NO hay un mecanismo de "avisame apenas cambie"
// como el que ofrece una base de datos en tiempo real — Netlify Blobs es más simple
// (guardar y leer, nada más). Para lograr que el otro celular se entere de todas
// formas, esta función pregunta cada 4 segundos "¿cambió algo?" y, si cambió,
// aplica el cambio. No es instantáneo como antes, pero funciona sin necesitar
// ningún servicio externo — coherente con "solo GitHub y Netlify".
export function subscribeToRemoteChanges(key, onRemoteChange) {
  const hh = getHouseholdId();
  if (!hh) return () => {};
  let stopped = false;

  async function poll() {
    if (stopped) return;
    try {
      const res = await fetch(apiUrl(key));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      reportStatus("sync", "ok");
      if (data.value && data.value !== lastKnownValue[key]) {
        lastKnownValue[key] = data.value;
        try {
          onRemoteChange(JSON.parse(data.value));
        } catch (e) {
          console.error("Error aplicando cambio remoto:", e);
        }
      }
    } catch (e) {
      console.error("subscribeToRemoteChanges error:", e);
      reportStatus("sync", "error", friendlyErrorMessage(e, "sincronizar con el otro celular"));
    }
  }

  const intervalId = setInterval(poll, 4000);
  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
