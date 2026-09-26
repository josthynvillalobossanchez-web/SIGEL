/*
 * Lista de requisitos de la contrasena que se va marcando mientras se escribe.
 * Los requisitos salen de utilidades/politica-contrasena.ts (copia de la
 * politica del backend).
 */
import { REQUISITOS_DE_CONTRASENA } from '../utilidades/politica-contrasena';
import { Icono } from './Icono';

export function RequisitosDeContrasena({ contrasena }: { contrasena: string }) {
  return (
    <ul className="requisitos-pass" aria-label="Requisitos de la contraseña">
      {REQUISITOS_DE_CONTRASENA.map((requisito) => {
        const cumple = requisito.cumple(contrasena);
        return (
          <li key={requisito.texto} data-cumple={cumple ? 'si' : 'no'}>
            <Icono nombre={cumple ? 'check' : 'info'} tamano={14} grosor={2.4} />
            <span>
              {requisito.texto}
              {/* Solo para lectores de pantalla: el color no basta para saber si se cumple. */}
              <span className="solo-lector">{cumple ? ' (cumplido)' : ' (pendiente)'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
