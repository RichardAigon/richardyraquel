// Reemplaza a window.storage (que solo existe adentro de Claude) por Firestore,
// para que Richard y Raquel compartan los mismos datos desde celulares distintos,
// en vivo, sin tener que hacer nada especial.
//
// Mantiene la MISMA forma que usa App.jsx (get/set con {key, value}), así que
// el motor financiero no necesitó ningún cambio.

import { db, firebaseConfigured } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const HOUSEHOLD_KEY = "ff-household-id";

// Identificador único de ESTE dispositivo/pestaña, generado una sola vez al cargar.
// Reemplaza al viejo mecanismo de "comparar marcas de tiempo" para detectar si un
// cambio en la base de datos lo escribimos nosotros mismos — comparar relojes era
// frágil (bastaba con hacer dos cambios seguidos para que se confundiera). Con un
// ID propio, la detección es exacta siempre, sin importar la velocidad de uso.
const deviceId = Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);

// Estado de conexión visible desde la UI (ver <CloudStatusBanner/> en App.jsx).
// No usamos React state acá porque este archivo es JS plano, así que avisamos
// con eventos del navegador y App.jsx los escucha. "source" separa el guardado
// normal de la sincronización en vivo, para que un "ok" de uno no tape un error
// del otro (por ejemplo: guardar funciona bien, pero la sincronización en vivo
// se cortó — antes ese error podía quedar tapado por el próximo guardado exitoso).
function reportStatus(source, status, message) {
  window.dispatchEvent(new CustomEvent("cloudstorage-status", { detail: { source, status, message } }));
}

export function getHouseholdId() {
  return localStorage.getItem(HOUSEHOLD_KEY);
}

export function setHouseholdId(id) {
  localStorage.setItem(HOUSEHOLD_KEY, id.trim());
}

function docRef(key) {
  const hh = getHouseholdId();
  if (!hh) throw new Error("Falta el código de familia");
  return doc(db, "households", hh, "data", key);
}

// Se instala como window.storage para que App.jsx funcione sin modificaciones.
export function installCloudStorage() {
  if (!firebaseConfigured) {
    reportStatus("storage", "unconfigured", "Firebase todavía no está configurado en src/firebase.js — los datos no se están guardando en la nube.");
  }
  window.storage = {
    async get(key) {
      if (!firebaseConfigured) return null;
      try {
        const snap = await getDoc(docRef(key));
        reportStatus("storage", "ok");
        if (!snap.exists()) return null;
        return { key, value: snap.data().value, shared: false };
      } catch (e) {
        console.error("cloudStorage.get error:", e);
        reportStatus("storage", "error", `No se pudo conectar con la base de datos: ${e.message}`);
        return null;
      }
    },
    async set(key, value) {
      if (!firebaseConfigured) return null;
      try {
        const updatedAt = Date.now();
        await setDoc(docRef(key), { value, updatedAt, writerId: deviceId });
        reportStatus("storage", "ok");
        return { key, value, shared: false };
      } catch (e) {
        console.error("cloudStorage.set error:", e);
        reportStatus("storage", "error", `No se pudo guardar en la nube: ${e.message}`);
        return null;
      }
    },
    async delete(key) {
      return null; // no usado por la app actualmente
    },
    async list() {
      return null; // no usado por la app actualmente
    },
  };
}

// Sincronización en vivo: si Raquel cambia algo desde su celular, el de Richard
// se actualiza solo (y viceversa), sin recargar la página.
// onRemoteChange recibe el estado nuevo (ya parseado) cuando cambia en otro dispositivo.
export function subscribeToRemoteChanges(key, onRemoteChange) {
  const hh = getHouseholdId();
  if (!hh) return () => {};
  const ref = doc(db, "households", hh, "data", key);
  return onSnapshot(
    ref,
    (snap) => {
      reportStatus("sync", "ok");
      if (!snap.exists()) return;
      const data = snap.data();
      // Si el cambio lo escribimos nosotros mismos (mismo ID de dispositivo), lo
      // ignoramos — ya lo tenemos aplicado localmente. Esto es exacto siempre,
      // a diferencia del método viejo de comparar relojes.
      if (data.writerId === deviceId) return;
      try {
        onRemoteChange(JSON.parse(data.value));
      } catch (e) {
        console.error("Error aplicando cambio remoto:", e);
      }
    },
    (error) => {
      // Esto es lo que antes fallaba en silencio: si la conexión en vivo se cae
      // (reglas de Firestore, límites, red), ahora se avisa con el cartel rojo.
      console.error("subscribeToRemoteChanges error:", error);
      reportStatus("sync", "error", `Se cortó la sincronización en vivo (${error.code || error.message}). Recargá la página en ambas computadoras.`);
    }
  );
}
