/*
 * Hook para un formulario que EDITA datos que ya existen y guarda solo lo
 * que cambio (Mi cuenta: datos personales y laborales).
 *
 *   const f = useFormularioDeCambios(original, {
 *     revisar: (datos) => problemaDeNombres(datos) ?? ...,   // null = todo bien
 *     enviar: (cambios) => actualizarMisDatos(cambios),       // solo lo que cambio
 *     alGuardar: (respuesta) => ...,                          // exito
 *   });
 *   <form ref={f.formulario} onSubmit={f.alEnviar}> ... f.datos, f.poner('nombre') ...
 *
 * Hace por la pantalla lo de siempre:
 *   - compara con el original (sin espacios de mas) para saber que cambio;
 *   - al enviar, primero revisa (y las fechas a medio escribir, con
 *     revisarFechasDeVencimiento) y muestra el primer problema;
 *   - manda solo los campos cambiados, con "" convertido a null (borrar);
 *   - maneja "ocupado" y el error del servidor, que se borra al corregir;
 *   - si el original cambia (se guardo y llego la version nueva), se
 *     vuelve a partir de el.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { textoDelError } from '../api/cliente';
import { revisarFechasDeVencimiento } from '../componentes/CampoFechaDeVencimiento';

type Datos = Record<string, string>;

export function useFormularioDeCambios<T extends Datos, R>(
  original: T,
  opciones: {
    revisar: (datos: T) => string | null;
    enviar: (cambios: Partial<Record<keyof T, string | null>>) => Promise<R>;
    alGuardar: (respuesta: R) => void;
    /** Se llama al tocar cualquier campo (p. ej. para borrar un aviso de exito). */
    alEditar?: () => void;
  },
) {
  const [datos, setDatos] = useState<T>(original);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => setDatos(original), [original]);

  const cambios = (Object.keys(datos) as (keyof T)[]).filter((campo) => datos[campo].trim() !== original[campo]);

  /** Devuelve el manejador de un campo: poner('nombre')(valor). */
  const poner = (campo: keyof T) => (valor: string) => {
    setError(null);
    opciones.alEditar?.();
    setDatos((d) => ({ ...d, [campo]: valor }));
  };

  async function guardar() {
    const problema = revisarFechasDeVencimiento(formulario.current) ?? opciones.revisar(datos);
    if (problema) return setError(problema);
    setOcupado(true);
    setError(null);
    try {
      const envio: Partial<Record<keyof T, string | null>> = {};
      for (const campo of cambios) envio[campo] = datos[campo].trim() || null;
      opciones.alGuardar(await opciones.enviar(envio));
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (cambios.length > 0 && !ocupado) void guardar();
  }

  function descartar() {
    setError(null);
    setDatos(original);
  }

  return { datos, setDatos, poner, cambios, hayCambios: cambios.length > 0, ocupado, error, formulario, alEnviar, descartar };
}
