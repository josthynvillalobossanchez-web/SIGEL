/*
 * Pie de un formulario de edicion (clase "pie-form" del prototipo): una nota
 * a la izquierda y "Descartar" / "Guardar cambios" a la derecha. Sin cambios,
 * los dos quedan bloqueados y lo explican (globo de ayuda).
 *
 *   <PieDeGuardado nota="Cada cambio queda en la bitacora." que="datos personales"
 *                  hayCambios={f.hayCambios} ocupado={f.ocupado} alDescartar={f.descartar} />
 */
import { BotonConAyuda } from './Botones';

export function PieDeGuardado(props: {
  nota: string;
  /** id de la nota, para ligarla a un campo con aria-describedby. */
  idNota?: string;
  /** Que se guarda, para el globo: "Guardar sus <que>". */
  que: string;
  hayCambios: boolean;
  ocupado: boolean;
  alDescartar: () => void;
}) {
  const { nota, idNota, que, hayCambios, ocupado, alDescartar } = props;
  return (
    <div className="pie-form">
      <span className="contador-paso" id={idNota}>
        {nota}
      </span>
      <div className="der">
        <BotonConAyuda
          texto="Descartar"
          ayuda="Volver a los datos guardados"
          bloqueadoPor={hayCambios ? null : 'no hay cambios que descartar.'}
          alHacerClic={alDescartar}
        />
        <BotonConAyuda
          clase="btn btn-primario"
          tipo="submit"
          texto="Guardar cambios"
          ayuda={`Guardar sus ${que}`}
          ocupado={ocupado}
          bloqueadoPor={hayCambios ? null : 'no hay cambios que guardar.'}
        >
          {ocupado ? 'Guardando…' : 'Guardar cambios'}
        </BotonConAyuda>
      </div>
    </div>
  );
}
