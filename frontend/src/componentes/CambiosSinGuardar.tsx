/*
 * Aviso de "cambios sin guardar" para las paginas de edicion.
 *
 * Si la persona llena media pagina de "Editar usuario" y toca otra opcion
 * del menu, perderia todo sin darse cuenta. Con esto:
 *   - La pagina avisa que tiene cambios:  useCambiosSinGuardar(hayCambios)
 *   - El menu, las migas y "Cancelar" preguntan antes de salir
 *     ("Seguir editando" / "Salir sin guardar").
 *   - Recargar o cerrar la pestana del navegador muestra el aviso propio del
 *     navegador (beforeunload).
 *
 * Limite conocido: el boton "atras" del navegador no se puede detener con
 * el enrutador que usamos (modo declarativo de react-router); solo el
 * aviso de recarga/cierre. Ver COSAS_POR_CORREGIR.
 *
 * El proveedor se monta una vez, en diseno/Marco.tsx.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Modal } from './Modal';

interface ContextoDeCambios {
  /** La pagina actual dice si tiene cambios sin guardar. */
  marcar: (hayCambios: boolean) => void;
  /** Ejecuta "accion" (salir) si no hay cambios; si los hay, pregunta antes. */
  salirSiSePuede: (accion: () => void) => void;
  /** true si ahora mismo hay cambios sin guardar. */
  hayCambios: () => boolean;
}

const Contexto = createContext<ContextoDeCambios | null>(null);

export function ProveedorDeCambiosSinGuardar({ children }: { children: ReactNode }) {
  const pendiente = useRef(false);
  const [preguntar, setPreguntar] = useState<(() => void) | null>(null);

  const marcar = useCallback((hayCambios: boolean) => {
    pendiente.current = hayCambios;
  }, []);

  const salirSiSePuede = useCallback((accion: () => void) => {
    if (!pendiente.current) accion();
    // Se guarda como funcion que devuelve la accion (asi lo pide useState).
    else setPreguntar(() => accion);
  }, []);

  const hayCambios = useCallback(() => pendiente.current, []);

  return (
    <Contexto.Provider value={{ marcar, salirSiSePuede, hayCambios }}>
      {children}
      {preguntar && (
        <Modal
          titulo="¿Salir sin guardar?"
          icono="info"
          descripcion="Hay cambios en esta página que todavía no se han guardado. Si sale ahora, se pierden."
          alCerrar={() => setPreguntar(null)}
          pie={
            <>
              <button className="btn btn-secundario" type="button" onClick={() => setPreguntar(null)} data-ayuda="Volver a la página sin perder nada">
                Seguir editando
              </button>
              <button
                className="btn btn-peligro"
                type="button"
                data-ayuda="Descartar los cambios y salir"
                onClick={() => {
                  pendiente.current = false;
                  const accion = preguntar;
                  setPreguntar(null);
                  accion();
                }}
              >
                Salir sin guardar
              </button>
            </>
          }
        />
      )}
    </Contexto.Provider>
  );
}

function useContexto(): ContextoDeCambios {
  const contexto = useContext(Contexto);
  // Fuera del marco (pantallas de acceso) no hay nada que cuidar.
  return contexto ?? { marcar: () => undefined, salirSiSePuede: (accion) => accion(), hayCambios: () => false };
}

/** Para las paginas de edicion: avisa si hay cambios sin guardar. */
export function useCambiosSinGuardar(hayCambios: boolean) {
  const { marcar } = useContexto();

  useEffect(() => {
    marcar(hayCambios);
    if (!hayCambios) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [hayCambios, marcar]);

  // Al salir de la pagina ya no hay nada pendiente.
  useEffect(() => () => marcar(false), [marcar]);
}

/** Ir a otra direccion, preguntando antes si hay cambios sin guardar. */
export function useIrSeguro() {
  const { salirSiSePuede } = useContexto();
  const navegar = useNavigate();
  return useCallback((a: string) => salirSiSePuede(() => navegar(a)), [salirSiSePuede, navegar]);
}

/** Para los enlaces del menu y las migas: frena el clic si hay cambios. */
export function useClicSeguro() {
  const { salirSiSePuede, hayCambios } = useContexto();
  const navegar = useNavigate();
  return useCallback(
    (e: MouseEvent, a: string) => {
      if (!hayCambios()) return; // el enlace sigue normal
      e.preventDefault();
      salirSiSePuede(() => navegar(a));
    },
    [salirSiSePuede, hayCambios, navegar],
  );
}

/** Enlace que pregunta antes de salir si hay cambios sin guardar. */
export function EnlaceSeguro({ a, children, clase }: { a: string; children: ReactNode; clase?: string }) {
  const clicSeguro = useClicSeguro();
  return (
    <Link to={a} className={clase} onClick={(e) => clicSeguro(e, a)}>
      {children}
    </Link>
  );
}

/** Para "Salir" (cerrar sesion) u otras acciones que dejan la pagina. */
export function useSalirSiSePuede() {
  return useContexto().salirSiSePuede;
}
