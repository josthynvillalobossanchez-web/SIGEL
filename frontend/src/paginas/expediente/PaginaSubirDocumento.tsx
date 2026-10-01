/*
 * Pagina "Subir documento", por pasos (regla de SINERGIA: crear = pagina
 * aparte, sin tener que bajar). Dos rutas:
 *   /mi-expediente/documentos/nuevo                 la persona, a su expediente
 *   /funcionarios/:id/expediente/documentos/nuevo   Recursos Humanos, al de otra persona
 *
 *   1. Tipo y archivo     el tipo dice que formatos acepta; se elige el archivo.
 *   2. Datos              titulo, descripcion y fecha del documento.
 *   3. Revisar y subir    resumen; al guardar se sube cifrado.
 *
 * El navegador revisa formato y tamano antes de subir (utilidades/archivos.ts)
 * para avisar rapido; el backend lo revisa otra vez (extension, tipo, firma
 * real del archivo, tamano) y manda. Si el backend rechaza algo, la pagina
 * vuelve al paso de ese dato.
 */
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ErrorDeApi, textoDelError } from '../../api/cliente';
import { consultarTiposDeDocumento, subirDocumento } from '../../api/documentos';
import { consultarFuncionario } from '../../api/funcionarios';
import { useCambiosSinGuardar, useIrSeguro } from '../../componentes/CambiosSinGuardar';
import { CampoFecha } from '../../componentes/CampoFecha';
import { FormularioPorPasos, type PasoDeFormulario } from '../../componentes/FormularioPorPasos';
import { Lista, Texto } from '../../componentes/CamposDeFormulario';
import { Mensaje } from '../../componentes/Mensaje';
import { ModalExito } from '../../componentes/ModalExito';
import { ZonaDeArchivo } from '../../componentes/ZonaDeArchivo';
import { useSesion } from '../../sesion/SesionProveedor';
import {
  TODOS_LOS_FORMATOS,
  describirFormatos,
  formatearTamano,
  problemaDeArchivo,
  TAMANO_MAXIMO_DOCUMENTO,
} from '../../utilidades/archivos';
import { formatearFechaSola, hoyEnCostaRica } from '../../utilidades/fechas';
import { nombreCompleto } from '../../utilidades/texto';
import { useConsulta } from '../../utilidades/useConsulta';

/** Que paso corrige cada error del backend. */
const PASO_DEL_ERROR: Record<string, number> = {
  TIPO_DOCUMENTO_INVALIDO: 0,
  TIPO_DOCUMENTO_INACTIVO: 0,
  TIPO_GENERADO_POR_SISTEMA: 0,
  ARCHIVO_REQUERIDO: 0,
  ARCHIVO_VACIO: 0,
  ARCHIVO_DEMASIADO_GRANDE: 0,
  FORMATO_NO_PERMITIDO: 0,
  FORMATO_NO_PERMITIDO_PARA_TIPO: 0,
  MIME_NO_COINCIDE: 0,
  CONTENIDO_NO_COINCIDE: 0,
  FECHA_NO_VALIDA: 1,
};

/** /mi-expediente/documentos/nuevo */
export function PaginaSubirMiDocumento() {
  return <SubirDocumento />;
}

/** /funcionarios/:id/expediente/documentos/nuevo */
export function PaginaSubirDocumentoAjeno() {
  const { id } = useParams();
  return <SubirDocumento funcionarioId={id} />;
}

function SubirDocumento({ funcionarioId: ajeno }: { funcionarioId?: string }) {
  const { usuario, tienePermisos } = useSesion();
  const navegar = useNavigate();
  const irSeguro = useIrSeguro();
  const propio = ajeno === undefined;
  const funcionarioId = ajeno ?? usuario?.funcionarioId ?? '';

  const volver = propio ? '/mi-expediente?pestana=documentos' : `/funcionarios/${funcionarioId}/expediente?pestana=documentos`;

  const { datos: tipos, error: errorDeTipos } = useConsulta(() => consultarTiposDeDocumento({ paraSubir: true }), []);
  // El nombre es solo para las migas: si no puede ver la ficha, se omite.
  const { datos: persona } = useConsulta(!propio && tienePermisos('funcionarios.ver') ? () => consultarFuncionario(funcionarioId) : null, [funcionarioId]);

  const [paso, setPaso] = useState(0);
  const [tipoId, setTipoId] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [problemaDeArchivoElegido, setProblemaDeArchivoElegido] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subido, setSubido] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  /** Ultimo titulo sugerido por SINERGIA: se reemplaza solo mientras la persona no lo haya escrito ella. */
  const sugerido = useRef('');
  const hoy = hoyEnCostaRica();

  const tipo = useMemo(() => tipos?.find((t) => t.id === tipoId) ?? null, [tipos, tipoId]);

  const hayCambios = Boolean(tipoId || archivo || titulo.trim() || descripcion.trim() || fecha);
  useCambiosSinGuardar(hayCambios && !subido);

  function elegirTipo(id: string) {
    setError(null);
    setTipoId(id);
    // Si ya habia archivo, se revisa contra el tipo nuevo (puede no aceptar su formato).
    const nuevo = tipos?.find((t) => t.id === id);
    if (archivo && nuevo) setProblemaDeArchivoElegido(problemaDeArchivo(archivo, nuevo.formatos, TAMANO_MAXIMO_DOCUMENTO));
  }

  function elegirArchivo(nuevo: File | undefined) {
    setError(null);
    if (!nuevo) {
      setArchivo(null);
      setProblemaDeArchivoElegido(null);
      return;
    }
    setArchivo(nuevo);
    setProblemaDeArchivoElegido(tipo ? problemaDeArchivo(nuevo, tipo.formatos, TAMANO_MAXIMO_DOCUMENTO) : null);
    // Se sugiere el nombre del archivo (sin extension) si el titulo esta vacio o sigue siendo la
    // sugerencia anterior; un titulo que la persona escribio no se toca.
    const nombreSugerido = nuevo.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').slice(0, 180);
    if (!titulo.trim() || titulo === sugerido.current) {
      sugerido.current = nombreSugerido;
      setTitulo(nombreSugerido);
    }
  }

  function revisarPaso(i: number): string | null {
    if (i === 0) {
      if (!tipo) return 'Elija el tipo de documento.';
      if (!archivo) return 'Elija el archivo del documento.';
      return problemaDeArchivo(archivo, tipo.formatos, TAMANO_MAXIMO_DOCUMENTO);
    }
    if (i === 1) {
      const limpio = titulo.trim();
      if (limpio.length < 2) return 'Escriba el título (al menos 2 caracteres).';
      if (limpio.length > 180) return 'El título no puede pasar de 180 caracteres.';
      if (fecha && fecha > hoy) return 'La fecha del documento no puede ser futura.';
    }
    return null;
  }

  async function guardar() {
    if (!tipo || !archivo) return;
    setOcupado(true);
    setError(null);
    try {
      await subirDocumento(
        funcionarioId,
        { tipoDocumentoId: tipo.id, titulo: titulo.trim(), descripcion: descripcion.trim() || undefined, fechaDocumento: fecha || undefined },
        archivo,
      );
      setSubido(titulo.trim());
    } catch (e) {
      setError(textoDelError(e));
      if (e instanceof ErrorDeApi && e.codigo in PASO_DEL_ERROR) setPaso(PASO_DEL_ERROR[e.codigo]);
    } finally {
      setOcupado(false);
    }
  }

  const PASOS: PasoDeFormulario[] = [
    { titulo: 'Tipo y archivo', sub: 'Qué se sube', descripcion: 'Cada tipo de documento acepta ciertos formatos. Elija el tipo y luego el archivo.' },
    { titulo: 'Datos del documento', sub: 'Título y fecha', descripcion: 'Cómo se va a llamar en el expediente y, si la tiene, su fecha de emisión.' },
    { titulo: 'Revisar y subir', sub: 'Confirmar', descripcion: 'Revise los datos. Al subir, el archivo se guarda cifrado y queda registrado en la bitácora.' },
  ];

  if (!funcionarioId) {
    return (
      <section className="pagina">
        <Mensaje tipo="info">Esta cuenta no está ligada a un funcionario, así que no tiene expediente al cual subir documentos.</Mensaje>
      </section>
    );
  }

  const migas = propio
    ? [{ texto: 'Mi expediente', a: volver }, { texto: 'Subir documento' }]
    : [
        { texto: 'Funcionarios', a: '/funcionarios' },
        ...(persona ? [{ texto: nombreCompleto(persona), a: `/funcionarios?ver=${persona.id}` }] : []),
        { texto: 'Expediente laboral', a: volver },
        { texto: 'Subir documento' },
      ];

  return (
    <>
      <FormularioPorPasos
        migas={migas}
        titulo="Subir documento"
        descripcion={
          propio
            ? 'Suba un documento a su expediente. Podrá editar o dar de baja solo lo que usted suba.'
            : `Suba un documento al expediente${persona ? ` de ${nombreCompleto(persona)}` : ''}.`
        }
        pasos={PASOS}
        actual={paso}
        alCambiarPaso={setPaso}
        revisarPaso={revisarPaso}
        alCancelar={() => irSeguro(volver)}
        alGuardar={() => void guardar()}
        textoGuardar="Subir documento"
        ocupado={ocupado}
        error={error ?? errorDeTipos}
        claveDeDatos={JSON.stringify([tipoId, archivo?.name, titulo, descripcion, fecha])}
      >
        {paso === 0 && (
          <>
            <Lista
              id="docNuevoTipo"
              etiqueta="Tipo de documento"
              obligatorio
              valor={tipoId}
              alCambiar={elegirTipo}
              opciones={(tipos ?? []).map((t) => ({ id: t.id, nombre: `${t.nombre} (${describirFormatos(t.formatos)})` }))}
              ayuda={tipo?.descripcion ?? 'Entre paréntesis están los formatos que acepta cada tipo.'}
            />
            <div className="campo">
              <label htmlFor="docNuevoArchivo">
                Archivo <span className="obligatorio">*</span>
              </label>
              <ZonaDeArchivo
                id="docNuevoArchivo"
                entradaRef={entrada}
                formatos={tipo ? tipo.formatos : TODOS_LOS_FORMATOS}
                tamanoMaximo={TAMANO_MAXIMO_DOCUMENTO}
                archivo={archivo}
                alElegir={elegirArchivo}
                obligatorio
                invalido={Boolean(problemaDeArchivoElegido)}
                descritoPor="docNuevoArchivo-nota"
              />
              <span className={problemaDeArchivoElegido ? 'msg-error' : 'ayuda'} id="docNuevoArchivo-nota" role={problemaDeArchivoElegido ? 'alert' : undefined}>
                {problemaDeArchivoElegido ??
                  (archivo
                    ? `${archivo.name} · ${formatearTamano(archivo.size)}`
                    : `Acepta ${describirFormatos(tipo ? tipo.formatos : TODOS_LOS_FORMATOS)}. Máximo ${formatearTamano(TAMANO_MAXIMO_DOCUMENTO)}.`)}
              </span>
            </div>
          </>
        )}

        {paso === 1 && (
          <>
            <Texto id="docNuevoTitulo" etiqueta="Título" obligatorio valor={titulo} alCambiar={setTitulo} max={180} placeholder="Ej.: Título de bachiller en Administración" />
            <div className="campo">
              <label htmlFor="docNuevoDescripcion">Descripción</label>
              <textarea id="docNuevoDescripcion" rows={2} maxLength={500} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
              <span className="ayuda">Opcional. {500 - descripcion.length} caracteres disponibles.</span>
            </div>
            <CampoFecha id="docNuevoFecha" etiqueta="Fecha del documento" valor={fecha} alCambiar={setFecha} max={hoy} ayuda="Opcional: cuándo se emitió, no cuándo se sube." />
          </>
        )}

        {paso === 2 && tipo && archivo && (
          <div className="revisar-bloques">
            <section className="info-bloque">
              <h3>Documento</h3>
              <dl className="info-rejilla">
                <Dato t="Tipo" v={tipo.nombre} />
                <Dato t="Archivo" v={`${archivo.name} · ${formatearTamano(archivo.size)}`} />
                <Dato t="Título" v={titulo.trim()} />
                <Dato t="Descripción" v={descripcion.trim() || 'Sin descripción'} />
                <Dato t="Fecha del documento" v={fecha ? formatearFechaSola(fecha) : 'Sin fecha'} />
              </dl>
            </section>
          </div>
        )}
      </FormularioPorPasos>

      {subido && (
        <ModalExito titulo="Documento subido con éxito" alAceptar={() => navegar(volver)}>
          <p>
            «{subido}» se guardó cifrado en {propio ? 'su expediente' : 'el expediente'}.
          </p>
        </ModalExito>
      )}
    </>
  );
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="dato">
      <dt>{t}</dt>
      <dd>{v}</dd>
    </div>
  );
}
