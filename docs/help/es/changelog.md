---
title: Generador de changelog
category: Trabajar con cambios
order: 34
summary: Convierte los commits convencionales entre dos refs en un changelog agrupado.
keywords: changelog notas de release release notes conventional commits commits convencionales generar generate CHANGELOG
source: 82fe9093441415a9cd578fe981f73d1082852b29
---

# Generador de changelog

Dale dos refs — por defecto **última etiqueta → HEAD** — y convierte los commits
que hay entre ellas en un changelog, agrupado por tipo de Conventional Commit.

![El generador de changelog](../../screenshots/changelog-gen.webp)

- Los **cambios que rompen compatibilidad** salen primero, vengan del tipo que
  vengan.
- Después Features, Fixes, Performance, y así.
- Los commits que no siguen ninguna convención acaban en **Otros** en vez de
  desaparecer — un changelog que pierde commits en silencio es peor que uno
  desordenado.

El resultado se abre en el mismo editor **Escribir / Vista previa** que la
descripción de una pull request, con su barra de herramientas: reescribe una
entrada, quita una línea que nadie necesita y comprueba cómo se ve renderizado
antes de que vaya a ninguna parte. Generar de nuevo reemplaza tus ediciones.

Copia el resultado, o **añádelo directamente al principio de `CHANGELOG.md`**.

> Escribir tus mensajes en [estilo Conventional](committing.md) es lo que hace
> esto útil. El generador es tan bueno como los asuntos que lee.

**Ver también:** [Hacer commits](committing.md) · [Hosting y pull requests](hosting.md)
