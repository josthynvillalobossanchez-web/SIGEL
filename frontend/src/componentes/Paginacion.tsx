/*
 * Barra de paginacion de las listas (clase "paginacion" del prototipo):
 * "Mostrando 1–20 de 57 funcionarios" y los botones Anterior / Siguiente.
 *
 *   <Paginacion resultado={resultado} nombre={['funcionario', 'funcionarios']}
 *               alCambiar={(n) => cambiar({ pagina: String(n) })} />
 *
 * "resultado" es la respuesta paginada del backend (pagina, tamano, total,
 * totalPaginas). El texto de cuantos hay se anuncia al lector de pantalla.
 */
import type { Pagina } from '../api/usuarios';

export function Paginacion({
  resultado,
  nombre,
  alCambiar,
}: {
  resultado: Pagina<unknown>;
  /** Como se llama cada fila: [singular, plural]. */
  nombre: [string, string];
  alCambiar: (pagina: number) => void;
}) {
  const { pagina, totalPaginas, total, tamano } = resultado;
  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const hasta = Math.min(pagina * tamano, total);
  return (
    <nav className="paginacion" aria-label={`Paginación de la lista de ${nombre[1]}`}>
      <span aria-live="polite">
        Mostrando {desde}–{hasta} de {total} {total === 1 ? nombre[0] : nombre[1]}
      </span>
      <div className="paginas">
        <button className="pag-btn" type="button" disabled={pagina <= 1} data-ayuda="Ir a la página anterior" onClick={() => alCambiar(pagina - 1)}>
          Anterior
        </button>
        <span className="pag-btn" aria-current="page" aria-label={`Página ${pagina} de ${totalPaginas}`}>
          {pagina} / {totalPaginas}
        </span>
        <button className="pag-btn" type="button" data-ayuda="Ir a la página siguiente" disabled={pagina >= totalPaginas} onClick={() => alCambiar(pagina + 1)}>
          Siguiente
        </button>
      </div>
    </nav>
  );
}
