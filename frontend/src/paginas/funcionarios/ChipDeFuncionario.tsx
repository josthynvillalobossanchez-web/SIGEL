/* Estado de un funcionario como en el prototipo: chip verde "Activo" o gris "Inactivo". */
import type { EstadoDeFuncionario } from '../../api/funcionarios';

export function ChipDeFuncionario({ estado }: { estado: EstadoDeFuncionario }) {
  return estado === 'activo' ? <span className="chip chip-exito">● Activo</span> : <span className="chip chip-neutro">● Inactivo</span>;
}
