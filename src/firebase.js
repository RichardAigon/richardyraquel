// Configuración de Firebase.
// Pegá acá los valores que te da Firebase cuando creás tu proyecto
// (Configuración del proyecto → tus apps → SDK setup and configuration).
// Ver el README para el paso a paso completo.

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "PEGA_ACA_TU_API_KEY",
  authDomain: "PEGA_ACA_TU_PROYECTO.firebaseapp.com",
  projectId: "PEGA_ACA_TU_PROYECTO_ID",
  storageBucket: "PEGA_ACA_TU_PROYECTO.appspot.com",
  messagingSenderId: "PEGA_ACA_TU_SENDER_ID",
  appId: "PEGA_ACA_TU_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// true si todavía quedan los valores de ejemplo sin reemplazar en este archivo
export const firebaseConfigured = !firebaseConfig.apiKey.startsWith("PEGA_ACA");
