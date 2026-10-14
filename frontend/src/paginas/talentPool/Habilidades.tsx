/*
 * Catalogo de habilidades del Talent Pool (ventana). RRHH lo va ampliando:
 * agregar, renombrar, cambiar de categoria e inactivar (las inactivas ya no
 * salen en el formulario publico, pero los candidatos que las tienen las
 * conservan). No se borran.
 */
import { useState } from 'react';
import { textoDelError } from '../../api/cliente';
import { consultarHabilidades, crearHabilidad, editarHabilidad, NOMBRE_DE_CATEGORIA, type CategoriaDeHabilidad } from '../../api/talentPool';
import { Icono } from '../../componentes/Icono';
import { Mensaje } from '../../componentes/Mensaje';
import { Modal } from '../../componentes/Modal';
import { useConsulta } from '../../utilidades/useConsulta';

const CATEGORIAS = Object.keys(NOMBRE_DE_CATEGORIA) as CategoriaDeHabilidad[];

export function Habilidades({ administra, alCerrar }: { administra: boolean; alCerrar: () => void }) {
  const lista = useConsulta(consultarHabilidades, []);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<CategoriaDeHabilidad>('tecnica');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function hacer(accion: () => Promise<unknown>, texto: string) {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      await accion();
      setAviso(texto);
      lista.recargar();
    } catch (e) {
      setError(textoDelError(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal titulo="Habilidades del Talent Pool" descripcion="Las que los candidatos pueden elegir en el formulario público." icono="lista" alCerrar={alCerrar} ancho textoCerrar="Cerrar">
      {administra && (
        <form
          className="tp-nueva-habilidad"
          onSubmit={(e) => {
            e.preventDefault();
            if (nombre.trim().length < 2) return setError('Escriba el nombre de la habilidad.');
            void hacer(() => crearHabilidad({ nombre: nombre.trim(), categoria }), `Se agregó «${nombre.trim()}».`).then(() => setNombre(''));
          }}
        >
          <div className="campo">
            <label htmlFor="habNombre">Nueva habilidad</label>
            <input id="habNombre" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Soldadura" />
          </div>
          <div className="campo">
            <label htmlFor="habCat">Categoría</label>
            <select id="habCat" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDeHabilidad)}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {NOMBRE_DE_CATEGORIA[c]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primario" disabled={ocupado}>
            <Icono nombre="mas" /> Agregar
          </button>
        </form>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      {lista.error && <Mensaje tipo="error">{lista.error}</Mensaje>}
      {lista.datos && (
        <div className="tp-catalogo">
          {CATEGORIAS.map((cat) => {
            const filas = lista.datos!.filter((h) => h.categoria === cat);
            if (!filas.length) return null;
            return (
              <section key={cat}>
                <h3>{NOMBRE_DE_CATEGORIA[cat]}</h3>
                <ul>
                  {filas.map((h) => (
                    <li key={h.id} data-activa={h.activo ? 'si' : 'no'}>
                      <span>
                        {h.nombre}
                        {!h.activo && <span className="chip chip-neutro">Inactiva</span>}
                      </span>
                      <small>{h.candidatos === 1 ? '1 candidato' : `${h.candidatos} candidatos`}</small>
                      {administra && (
                        <span className="tp-catalogo-acc">
                          <select
                            aria-label={`Categoría de ${h.nombre}`}
                            value={h.categoria}
                            disabled={ocupado}
                            onChange={(e) => void hacer(() => editarHabilidad(h.id, { categoria: e.target.value as CategoriaDeHabilidad }), `«${h.nombre}» pasó a ${NOMBRE_DE_CATEGORIA[e.target.value as CategoriaDeHabilidad].toLowerCase()}.`)}
                          >
                            {CATEGORIAS.map((c) => (
                              <option key={c} value={c}>
                                {NOMBRE_DE_CATEGORIA[c]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn-texto"
                            disabled={ocupado}
                            onClick={() => void hacer(() => editarHabilidad(h.id, { activo: !h.activo }), h.activo ? `«${h.nombre}» ya no sale en el formulario.` : `«${h.nombre}» vuelve a salir en el formulario.`)}
                            data-ayuda={h.activo ? 'Que ya no salga en el formulario público (los candidatos que la tienen la conservan)' : 'Que vuelva a salir en el formulario público'}
                          >
                            {h.activo ? 'Inactivar' : 'Activar'}
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
