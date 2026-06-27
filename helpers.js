@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light; }

html, body, #root { height: 100%; }
body {
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
  background: #F6F8F9;
  color: #0A0B0C;
  -webkit-font-smoothing: antialiased;
}

@layer components {
  .btn {
    @apply inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2
           text-sm font-medium transition-colors disabled:opacity-50
           disabled:cursor-not-allowed;
  }
  .btn-primary { @apply btn bg-deep text-white hover:bg-steel; }
  .btn-ghost   { @apply btn bg-transparent text-deep hover:bg-mist; }
  .btn-soft    { @apply btn bg-mist text-deep hover:bg-sky/40; }
  .card        { @apply bg-white rounded-xl border border-slate-200/70 shadow-sm; }
  .input {
    @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm
           outline-none focus:border-deep focus:ring-1 focus:ring-deep;
  }
  .label { @apply block text-xs font-medium text-slate-500 mb-1; }
  .pill  { @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium; }
}

/* =====================================================================
   TEMA CARBÓN (sutil, con juego de sombras)
   Para el fondo del Login y la barra lateral.
   ===================================================================== */
.carbon {
  background-color: #0c0d0f;
  background-image:
    radial-gradient(120% 80% at 50% -8%, rgba(255,255,255,0.045), transparent 60%),
    radial-gradient(90% 90% at 0% 0%, rgba(231,60,50,0.05), transparent 55%),
    repeating-linear-gradient(45deg,  rgba(255,255,255,0.012) 0 2px, transparent 2px 4px),
    repeating-linear-gradient(-45deg, rgba(0,0,0,0.10) 0 2px, transparent 2px 4px);
}
.carbon-sidebar {
  background-color: #101113;
  background-image:
    radial-gradient(110% 34% at 0% 0%, rgba(231,60,50,0.10), transparent 60%),
    linear-gradient(180deg, rgba(255,255,255,0.04), transparent 16%),
    linear-gradient(27deg,  rgba(255,255,255,0.035) 5px, transparent 5px) 0 5px,
    linear-gradient(207deg, rgba(255,255,255,0.035) 5px, transparent 5px) 10px 0,
    linear-gradient(27deg,  rgba(0,0,0,0.55) 5px, transparent 5px) 0 10px,
    linear-gradient(207deg, rgba(0,0,0,0.55) 5px, transparent 5px) 10px 5px;
  background-size: auto, auto, 20px 20px, 20px 20px, 20px 20px, 20px 20px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 8px 0 28px rgba(0,0,0,0.55);
}
/* Línea de tiempo de gestión (stepper horizontal) */
.stepper { @apply flex items-center gap-0 overflow-x-auto pb-1; }
.step-dot {
  @apply grid place-items-center w-7 h-7 rounded-full text-[11px] font-bold shrink-0
         border-2 transition-colors;
}
.step-line { @apply h-0.5 flex-1 min-w-[18px] rounded-full transition-colors; }
