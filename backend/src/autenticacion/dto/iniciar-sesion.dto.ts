import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Lo unico que el backend acepta en el cuerpo del login.
 *
 * Gracias al ValidationPipe global (main.ts), cualquier campo que no este
 * declarado aqui hace que la peticion se rechace con 400. No se puede colar
 * un "esAdministrador: true" ni nada por el estilo.
 */
export class IniciarSesionDto {
  @IsEmail({}, { message: 'El correo no tiene un formato valido.' })
  @MaxLength(150)
  correo!: string;

  // A proposito no se valida largo minimo ni complejidad: eso se exige al
  // CREAR o cambiar la contrasena, no al usarla. Validarlo aqui solo le diria
  // a un atacante como son las contrasenas del sistema.
  @IsString()
  @IsNotEmpty({ message: 'La contrasena es obligatoria.' })
  @MaxLength(128)
  contrasena!: string;
}
