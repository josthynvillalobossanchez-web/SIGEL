# SIGEL

## Sistema Integral de Gestión Laboral

Sistema web para la gestión centralizada de expedientes laborales de la Municipalidad de Palmares, Costa Rica.

## Descripción

SIGEL tiene como objetivo centralizar la información laboral de los funcionarios municipales, facilitar la búsqueda y consulta de información y reducir la dependencia de expedientes físicos y archivos dispersos.

El sistema contempla la gestión de expedientes laborales, documentos, usuarios y roles, vacaciones, incapacidades, permisos, licencias, capacitaciones y otros procesos relacionados con la gestión laboral, de acuerdo con los requerimientos aprobados del proyecto.

## Alcance

El sistema será utilizado por el personal autorizado de la Municipalidad de Palmares y permitirá administrar la información correspondiente a los procesos contemplados dentro del alcance aprobado del proyecto.

SIGEL será una aplicación independiente y contará con su propia base de datos. Durante el desarrollo del proyecto no se contempla la interoperabilidad con otros sistemas institucionales.

## Tecnologías

### Frontend
- React
- Vite
- TypeScript

### Backend
- NestJS
- TypeScript
- API REST

### Base de datos
- MySQL 8.4
- Prisma ORM

### Infraestructura
- Docker
- Docker Compose

### Control de versiones
- Git
- GitHub

## Metodología

El desarrollo del proyecto se realiza utilizando Scrum, mediante iteraciones planificadas, historias de usuario, criterios de aceptación y tareas técnicas. El backlog se administra en Jira.

| Sprint | Épicas |
|---|---|
| Sprint 1 | Autenticación y usuarios · Funcionarios y expediente · Gestión documental |
| Sprint 2 | Gestión de vacaciones · Permisos, licencias e incapacidades · Capacitaciones y horas extra |
| Sprint 3 | Talent Pool · Notificaciones · Auditoría |

## Seguridad

El sistema se desarrolla considerando controles de autenticación, autorización, permisos granulares por clave `modulo.accion`, validación de datos en el backend, protección de archivos, auditoría y buenas prácticas de seguridad. Las contraseñas se almacenan con Argon2id y los identificadores públicos son UUID.

## Estructura del repositorio

```
SIGEL/
├── backend/            API en NestJS + Prisma
├── frontend/           Interfaz en React + Vite (pendiente de crear)
├── docs/               Documentación del proyecto
└── docker-compose.yml  MySQL 8.4 para desarrollo
```

## Cómo levantar el proyecto

Requisitos: Docker Desktop, Node.js 22.22.3 o superior y Git.

```bash
docker compose up -d          # levanta MySQL
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate -- --name inicial
npm run db:seed
npm run dev                   # API en http://localhost:3000/api
```

El paso a paso completo, con la explicación de cada comando y los problemas más
comunes, está en [`docs/GUIA_DESARROLLO.md`](docs/GUIA_DESARROLLO.md).

## Estado del proyecto

Sprint 1 en desarrollo: autenticación y usuarios, funcionarios y expediente, y gestión documental. Las fases de análisis, diseño y prototipado están concluidas y el prototipo de interfaces fue aprobado por el supervisor.

Al 19 de setiembre de 2026 el backend ya levanta contra MySQL: el modelo de datos del Sprint 1 está migrado, los permisos, roles y catálogos quedaron sembrados y el endpoint `GET /api/salud` responde con la base conectada. El siguiente paso es el módulo de autenticación.

## Proyecto

**SIGEL — Municipalidad de Palmares**

Proyecto desarrollado en el marco de la Práctica Profesional Supervisada.
