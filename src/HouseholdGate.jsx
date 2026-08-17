import React, { useState } from "react";
import { getHouseholdId, setHouseholdId, installCloudStorage } from "./cloudStorage";

export default function HouseholdGate({ children }) {
  const [ready, setReady] = useState(!!getHouseholdId());
  const [code, setCode] = useState("");

  if (ready) {
    installCloudStorage();
    return children;
  }

  function submit() {
    if (!code.trim()) return;
    setHouseholdId(code);
    setReady(true);
  }

  return (
    <div style={styles.root}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap');`}</style>
      <div style={styles.card}>
        <div style={styles.emoji}>🏠</div>
        <h1 style={styles.title}>Finanzas Familia</h1>
        <p style={styles.sub}>
          Elegí un código único para tu hogar. Usá <b>el mismo código exacto</b> en el celular de Richard y en el de
          Raquel — así ambos ven la misma información, sincronizada.
        </p>
        <input
          style={styles.input}
          type="text"
          placeholder="ej: richard-raquel-2026"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        <button style={styles.btn} onClick={submit} disabled={!code.trim()}>
          Entrar
        </button>
        <p style={styles.hint}>
          Guardalo en un lugar seguro (una nota, WhatsApp entre ustedes). Si lo escriben distinto en cada celular, cada
          uno va a ver datos separados.
        </p>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#FAF7F1", fontFamily: "'Inter', sans-serif", padding: 20,
  },
  card: {
    background: "#FFFFFF", borderRadius: 24, padding: "32px 26px", maxWidth: 380, width: "100%",
    boxShadow: "0 8px 24px rgba(34,38,43,0.08)", border: "1px solid #EAE4D8", textAlign: "center",
  },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 24, margin: "0 0 10px", color: "#22262B" },
  sub: { fontSize: 13.5, color: "#767D87", lineHeight: 1.5, marginBottom: 20 },
  input: {
    width: "100%", border: "1px solid #EAE4D8", borderRadius: 12, padding: "13px 14px", fontSize: 15,
    background: "#FAF7F1", color: "#22262B", fontFamily: "inherit", marginBottom: 12, boxSizing: "border-box",
  },
  btn: {
    width: "100%", background: "#146C55", color: "#fff", border: "none", borderRadius: 14, padding: "13px 18px",
    fontWeight: 700, fontSize: 14.5, cursor: "pointer",
  },
  hint: { fontSize: 11.5, color: "#767D87", marginTop: 16, lineHeight: 1.4 },
};
