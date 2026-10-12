# Guía de lanzamiento: de este repositorio a la App Store y Google Play

Esta guía cubre producto, monetización, requisitos de las tiendas y los pasos técnicos para publicar **Salda** (nombre de trabajo; cámbialo si quieres, ver §7).

---

## 1. Posicionamiento

**Una frase:** *La app bilingüe y privada para salir de deudas y entender en qué se va tu dinero, sin dar la contraseña de tu banco.*

**Para quién:**
- Personas en EE. UU. con deudas de tarjetas y préstamos que pagan demasiados intereses.
- Mercado hispano en EE. UU. (más de 60 millones de personas) y Latinoamérica: pocas apps de finanzas están pensadas en español, con remesas, pagos en efectivo y bancos estadounidenses.
- Personas que desconfían de conectar su banco a una app (privacidad).

**Diferenciadores frente a la competencia** (YNAB, Monarch, Rocket Money, Copilot, Empower; Mint cerró en 2024):
1. **Primero la deuda:** plan avalancha/bola de nieve, comparación contra pagar solo mínimos, fecha de libertad y "¿cuánto necesito para salir en 24 meses?".
2. **Bilingüe nativo** (español/inglés), con categorías como *Envíos a familia* y gastos en efectivo como la renta.
3. **Privado por diseño:** los datos viven en el teléfono (SQLite). Importación por CSV, sin agregadores bancarios.
4. **Plan guiado tipo CFP:** pasos priorizados, puntaje de salud financiera y alertas en lenguaje simple.
5. **Precio accesible** frente a competidores que cobran alrededor de $100 al año (verifica precios actuales antes de fijar el tuyo).

---

## 2. Monetización recomendada: freemium + suscripción

| | Gratis | Pro |
|---|---|---|
| Movimientos manuales, categorías, gastos fijos | ✅ | ✅ |
| Plan de deudas (avalancha/bola de nieve) | Hasta 3 deudas | Ilimitado + meta por fecha |
| Importación CSV | Último mes | Historial completo, todas las cuentas |
| Análisis | Mes actual | 12 meses, tendencias, comercios |
| Presupuestos | 3 categorías | Ilimitados + sugerencia automática |
| Exportar datos | — | ✅ |
| Próximo: recordatorios, respaldo en la nube, widgets | — | ✅ |

**Precio sugerido para probar:** $4.99/mes o $29.99/año con 7 días de prueba gratis; opción "de por vida" (~$59.99) para quien no quiere suscripciones. Haz pruebas A/B de precio después de las primeras 500 descargas.

**Implementación:** usa **RevenueCat** (`react-native-purchases`). Maneja App Store y Google Play con una sola API, recibos, pruebas gratis y métricas. Requiere una *development build* (no funciona en Expo Go). Crea un módulo `src/state/entitlements.ts` que exponga `isPro` y úsalo para bloquear las funciones Pro.

**Ingresos adicionales (con cuidado):** enlaces de afiliado a cuentas de ahorro de alto rendimiento o tarjetas de transferencia de saldo. Si lo haces, **declara la relación comercial** y nunca lo disfraces de recomendación neutral.

---

## 3. Requisitos de las tiendas

### Cuentas
- **Apple Developer Program:** $99 USD/año. Puedes registrarte como persona física o como empresa (LLC; necesitas número D-U-N-S). Como empresa, tu nombre legal aparece como vendedor, lo que da más confianza en una app de finanzas.
- **Google Play Console:** $25 USD una sola vez. Las cuentas **personales** nuevas deben hacer una **prueba cerrada con al menos 12 testers durante 14 días** antes de publicar en producción. Las cuentas de organización no tienen ese requisito.

### Privacidad (obligatorio en ambas)
- **URL pública de política de privacidad.** Usa `docs/PRIVACY_POLICY.md` como base (revísala con un abogado) y publícala, por ejemplo con GitHub Pages.
- **Apple – App Privacy ("nutrition label"):** la versión actual no recopila datos fuera del dispositivo, así que corresponde **"Data Not Collected"**. Si agregas analítica, crash reporting o RevenueCat, actualízalo.
- **Google – Data safety:** declara que no se recopilan ni comparten datos, que los datos no salen del dispositivo y que el usuario puede borrarlos (Ajustes → Borrar todos mis datos).
- **Google – Financial features declaration:** en Play Console → Contenido de la app, declara que la app es de **"gestión de finanzas personales / presupuesto"** y que **no** ofrece préstamos, inversión ni transferencias de dinero.

### Contenido y políticas
- **Aviso legal visible:** la app ya muestra que es educativa y no constituye asesoría financiera (onboarding y Ajustes). Mantén este lenguaje; no prometas resultados ("sal de deudas en 6 meses garantizado").
- **No des recomendaciones de inversión personalizadas** (acciones o fondos específicos) sin estar registrado como asesor de inversiones. El plan actual habla de categorías generales (401(k), IRA, fondo de emergencia), lo cual es educación financiera general.
- **Clasificación por edad:** 4+ / Everyone.
- **Suscripciones (Apple 3.1.2):** la pantalla de pago debe mostrar precio, periodo, renovación automática y enlaces a Términos y Privacidad.
- **Cifrado:** `ios.config.usesNonExemptEncryption: false` ya está en `app.json` (la app solo usa el cifrado estándar del sistema).

### Material para la ficha (en español e inglés)
- Ícono de 1024×1024 sin transparencia (el actual es el de la plantilla de Expo: **hay que diseñar uno propio**).
- Capturas de iPhone de 6.9" (1320×2868) y de teléfono Android; 5-8 por idioma. Pantallas sugeridas: Plan de deudas, Comparación vs. mínimos, Importación CSV, Análisis, Mi plan, Gastos fijos.
- Palabras clave (ASO):
  - ES: deudas, presupuesto, gastos, finanzas personales, ahorro, tarjeta de crédito, bola de nieve, control de gastos, dinero.
  - EN: debt payoff, budget, expense tracker, snowball, avalanche, credit card, spending, money manager.
- Subtítulo: "Sal de deudas y controla tus gastos" / "Debt payoff & budget planner".

---

## 4. Pasos técnicos para publicar (Expo EAS)

```bash
# 1. Herramientas
npm install
npx eas-cli@latest login

# 2. Configura identificadores únicos en app.json
#    ios.bundleIdentifier y android.package (ej. com.tuempresa.salda)
#    Deben ser tuyos y no se pueden cambiar después de publicar.

# 3. Vincula el proyecto con EAS (agrega extra.eas.projectId a app.json)
npx eas-cli@latest init

# 4. Prueba en tu teléfono con una build interna
npx eas-cli@latest build --profile preview --platform android   # genera un APK instalable
npx eas-cli@latest build --profile preview --platform ios       # requiere registrar tu iPhone

# 5. Builds de producción
npx eas-cli@latest build --profile production --platform all

# 6. Envía a las tiendas
npx eas-cli@latest submit --platform ios       # App Store Connect → TestFlight → revisión
npx eas-cli@latest submit --platform android   # Play Console → prueba cerrada → producción

# 7. Correcciones rápidas de JavaScript sin pasar por revisión
npx eas-cli@latest update --branch production --message "Corrige X"
```

`eas.json` ya incluye los perfiles `preview` y `production` (con incremento automático de versión).

---

## 5. Hoja de ruta sugerida

| Versión | Funciones | Por qué |
|---|---|---|
| **1.0 (este repositorio)** | Movimientos, importación CSV con auto-categorización y reglas aprendidas, plan de deudas, gastos fijos con detección de suscripciones, presupuestos, análisis, plan CFP, puntaje de salud, ES/EN, modo oscuro | Producto mínimo completo y privado |
| 1.1 | **Recordatorios de pago** (`expo-notifications`), **bloqueo con Face ID/huella** (`expo-local-authentication`), **respaldo y restauración** (archivo cifrado en iCloud/Google Drive), widgets | Seguridad y retención; sin respaldo, cambiar de teléfono hoy implica perder datos |
| 1.2 | Suscripción Pro con RevenueCat, metas de ahorro, varias cuentas, importación de OFX/QFX | Ingresos |
| 2.0 | Sincronización bancaria opcional (Plaid/MX/Teller), cuentas de usuario con sincronización cifrada | Comodidad; implica backend, costos por conexión, revisión de seguridad y la obligación de permitir borrar la cuenta desde la app |
| 2.x | Lectura de recibos, asistente de IA (con consentimiento explícito), reporte de crédito | Diferenciación |

---

## 6. Métricas a seguir

- Activación: % de usuarios que agregan una deuda **e** importan un CSV en la primera semana.
- Retención D7/D30.
- Conversión de prueba a pago y cancelaciones.
- Métrica de impacto (para marketing, agregada y anónima, solo con consentimiento): deuda pagada e intereses ahorrados por los usuarios.

---

## 7. Pendientes antes de publicar

- [ ] Verificar que el nombre "Salda" esté disponible en ambas tiendas y como marca (USPTO). Para cambiarlo: `app.json` (`name`, `slug`, `scheme`), `locales/*.json` y `app.name` en `src/i18n/es.ts` y `en.ts`.
- [ ] Cambiar `ios.bundleIdentifier` y `android.package` a un dominio propio.
- [ ] Diseñar el ícono y la pantalla de inicio (splash) definitivos.
- [ ] Publicar la política de privacidad y los términos de uso.
- [ ] Probar en dispositivos reales con CSV de tus propios bancos (iPhone y Android), incluyendo la importación desde la app Archivos/Drive.
- [ ] Implementar respaldo y restauración (v1.1) o advertirlo claramente en la ficha.
- [ ] Revisión legal del aviso y la política de privacidad.
