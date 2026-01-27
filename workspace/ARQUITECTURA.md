# Arquitectura - Contractor Passport (MVP)

> Documento técnico conciso para entender el sistema actual, las decisiones de diseño y los trade-offs. No incluye roadmap ni features futuras.

## 1) Visión de alto nivel

**Propósito del sistema**
Emitir y verificar credenciales de confianza para contractors ("passports") basadas en verificaciones, con niveles de clearance que un employer pueda consumir rápidamente.

**Flujo end-to-end (texto)**
1. Contractor se onboardea (nombre + email).
2. Contractor completa verificaciones (identity, github, linkedin, background_check, references).
3. Backend evalúa elegibilidad y emite credential JWT con tier y expiración.
4. Employer verifica la credencial vía endpoint público o con JWKS.

**Diagrama de flujo (ASCII)**
Contractor -> [API Onboard] -> Contractor
Contractor -> [API Create Verification] -> Verification (pending)
Verifier -> [API Update Verification] -> Verification (verified/failed)
System -> [API Issue Credential] -> Credential (JWT)
Employer -> [API Verify Credential] -> Status + Metadata
Employer -> [JWKS] -> Public Key

## 2) Decisiones de seguridad (con razones)

**JWT RS256 (asymmetric)**
- Permite verificación pública sin exponer la clave privada.
- Escala a múltiples verificadores (employers) sin compartir secretos.
- Alineado con estándar JWKS para distribución de claves.

**JWKS + `kid`**
- `kid` permite rotar claves sin invalidar verificaciones históricas.
- Publicar JWKS hace posible verificación offline por terceros.

**Claims explícitos**
- `tier`, `verifications` y tiempos (`iat`, `exp`) están en el JWT para que el employer evalúe riesgo sin consultar DB.

**Threat model básico**
- Previene falsificación de credenciales (firma RS256 + verificación).
- Previene replay prolongado (expiración corta por tier).
- Reduce dependencia de estado (verificación por JWT + JWKS).

## 3) Arquitectura de tiers

**Tiers definidos (actual esperado por producto, no implementado aún en código):**

- **PROVISIONAL (24h)**
  - required: identity + github + linkedin
  - background_check + references pueden estar en pending

- **FULL_CLEARANCE (7-10 días)**
  - required: identity + github + linkedin
  - background_check verificado
  - **2+ referencias verificadas**

**Por qué tiers explícitos vs roles libres**
- Claridad de riesgo para employer y contractor.
- Permite UX simple ("provisional" vs "full").
- Facilita pricing y políticas de uso.

**Escalabilidad**
- Añadir tiers nuevos es agregar reglas de verificación y expiración.
- Permite migrar a permisos granulares en el futuro si el mercado lo requiere.

## 4) Esquema de datos crítico (Prisma)

**Entidades principales**
- `Contractor`: identidad base.
- `Verification`: estado de cada verificación.
- `Credential`: JWT emitido (tier, expiración, revocación).
- `AuditLog`: trazabilidad de eventos.

**Campos clave**
- `Verification.type` y `status` controlan elegibilidad.
- `Credential.tier` y `expiresAt` reflejan el clearance.
- `AuditLog` permite debugging y compliance básico.

## 5) JWT claims structure

**Payload actual**
```json
{
  "sub": "contractorId",
  "iss": "contractor-passport",
  "tier": "PROVISIONAL|FULL_CLEARANCE",
  "verifications": [
    {
      "type": "identity|github|linkedin|background_check|reference",
      "status": "verified",
      "provider": "persona|checkr|manual",
      "completedAt": "2026-01-27T20:59:04.430Z"
    }
  ],
  "iat": 1738010000,
  "exp": 1738096400
}
```

**Header esperado (para soporte de JWKS)**
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "contractor-passport-key-1"
}
```

## 6) API endpoints principales (Express)

- `POST /api/contractors/onboard`
  - Crea contractor
- `GET /api/contractors/:id`
  - Devuelve contractor + verifications + credentials
- `POST /api/contractors/:id/verifications`
  - Crea verificación (pending)
- `PATCH /api/verifications/:id`
  - Actualiza status (verified/failed)
- `POST /api/contractors/:id/credentials`
  - Emite JWT según elegibilidad
- `GET /api/credentials/:id/verify`
  - Verifica JWT + estado de credential
- `GET /.well-known/jwks.json`
  - JWKS para verificación pública

## 7) Decisiones alternativas y trade-offs

**Por qué no HS256**
- HS256 exige compartir secret con verificadores externos (malísimo para escalamiento).
- RS256 permite verificación pública sin exponer firma.

**Por qué no roles libres**
- Roles arbitrarios crean ambigüedad de riesgo. El valor está en claridad operativa.

**Complejidad vs flexibilidad**
- MVP prefiere reglas estrictas y simples.
- Se sacrifica flexibilidad a cambio de interpretabilidad por terceros.

**Deuda técnica conocida (bugs críticos no resueltos aún)**
1. **Claves JWT efímeras**: el server genera un par RSA nuevo en cada arranque. Resultado: credenciales emitidas se invalidan tras restart.
2. **Tiers desalineados**: el código actual exige solo identity+github+linkedin para FULL_CLEARANCE y solo identity para PROVISIONAL (incorrecto).
3. **JWT sin `kid`**: el JWT no incluye header `kid`, pero el JWKS sí lo publica.
4. **Referencias insuficientes**: no hay validación de “mínimo 2 referencias” para FULL_CLEARANCE.

**Deuda técnica adicional (no bloqueante)**
- `Verification.data` se almacena sin cifrado (ok para dev, no para prod).
- `JWT_SECRET` existe pero no se usa (riesgo de confusión).
- Zod schemas no están compartidos entre backend y frontend.

## 8) Pivot readiness

**Reutilizable**
- Emisión/verificación de credenciales con JWT + JWKS.
- Sistema de verificación escalonado con tiers.
- Modelo de auditoría y trazabilidad.

**Específico a Contractor Passport**
- Tipos de verificación (`identity`, `github`, `linkedin`, `background_check`, `reference`).
- Reglas de tiers y expiraciones (24h / 7-10 días).
- Copy y positioning del flujo de onboarding.

**Cómo adaptar a otro problema**
- Sustituir `Verification.type` por señales del nuevo dominio.
- Reescribir reglas de elegibilidad y expiración.
- Mantener infra JWT/JWKS y audit logs como base.

## 9) Estado actual

- Backend funcional con Prisma + Express.
- Emisión de credenciales y verificación pública disponibles.
- Falta aplicar los fixes críticos descritos arriba antes de producción.

