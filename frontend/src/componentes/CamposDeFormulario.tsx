/*
 * Campos de formulario simples, con su etiqueta, asterisco de obligatorio y
 * ayuda debajo (ligada con aria-describedby para el lector de pantalla).
 * Se usan en "Registrar / Editar funcionario" y en "Mi cuenta".
 *
 *   <Texto id="fnNombre" etiqueta="Nombre" valor={..} alCambiar={..} max={50} obligatorio />
 *   <Lista id="fnPuesto" etiqueta="Puesto" valor={..} alCambiar={..} opciones={puestos} />
 */
export function Texto(props: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  obligatorio?: boolean;
  max: number;
  tipo?: string;
  placeholder?: string;
  ayuda?: string;
  /** Al salir del campo (p. ej. para dar formato al telefono). */
  alSalir?: () => void;
}) {
  return (
    <div className="campo">
      <label htmlFor={props.id}>
        {props.etiqueta} {props.obligatorio && <span className="obligatorio">*</span>}
      </label>
      <input
        id={props.id}
        type={props.tipo ?? 'text'}
        value={props.valor}
        onChange={(e) => props.alCambiar(e.target.value)}
        onBlur={props.alSalir}
        maxLength={props.max}
        placeholder={props.placeholder}
        aria-required={props.obligatorio || undefined}
        aria-describedby={props.ayuda ? `${props.id}-ayuda` : undefined}
        autoComplete="off"
      />
      {props.ayuda && (
        <span className="ayuda" id={`${props.id}-ayuda`}>
          {props.ayuda}
        </span>
      )}
    </div>
  );
}

export function Lista(props: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  opciones: { id: string; nombre: string }[];
  obligatorio?: boolean;
  /** Texto de la opcion vacia; sin esto, la opcion vacia dice "Seleccione...". */
  vacio?: string;
  ayuda?: string;
}) {
  return (
    <div className="campo">
      <label htmlFor={props.id}>
        {props.etiqueta} {props.obligatorio && <span className="obligatorio">*</span>}
      </label>
      <select
        id={props.id}
        value={props.valor}
        onChange={(e) => props.alCambiar(e.target.value)}
        aria-required={props.obligatorio || undefined}
        aria-describedby={props.ayuda ? `${props.id}-ayuda` : undefined}
      >
        <option value="">{props.vacio ?? 'Seleccione…'}</option>
        {props.opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
      {props.ayuda && (
        <span className="ayuda" id={`${props.id}-ayuda`}>
          {props.ayuda}
        </span>
      )}
    </div>
  );
}
