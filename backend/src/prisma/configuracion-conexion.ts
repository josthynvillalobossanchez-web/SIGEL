/**
 * Traduce la DATABASE_URL de backend/.env a la configuracion que espera el
 * driver de MariaDB, que es el que Prisma 7 usa para hablar con MySQL.
 *
 * Se hace aqui, en codigo, y no agregando parametros a la DATABASE_URL,
 * porque esa misma cadena la leen tambien los comandos de Prisma
 * (migrate, studio, seed) y ellos no entienden las opciones del driver.
 */

interface ConfiguracionMariaDb {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  ssl?: boolean;
  allowPublicKeyRetrieval?: boolean;
}

export function configuracionDeConexion(url: string): ConfiguracionMariaDb {
  const direccion = new URL(url);

  const configuracion: ConfiguracionMariaDb = {
    host: direccion.hostname,
    port: direccion.port ? Number(direccion.port) : 3306,
    user: decodeURIComponent(direccion.username),
    password: decodeURIComponent(direccion.password),
    database: decodeURIComponent(direccion.pathname.replace(/^\//, '')),
    connectionLimit: 10,
  };

  /**
   * MySQL 8 autentica con "caching_sha2_password": la contrasena viaja
   * cifrada con la llave publica RSA del servidor.
   *
   * Con TLS (BD_TLS=true) el canal ya va cifrado y el driver obtiene esa
   * llave de forma segura. Asi debe quedar en el servidor de la
   * Municipalidad.
   *
   * Sin TLS hay que autorizar al cliente a pedirle la llave al servidor.
   * Eso solo es aceptable cuando la conexion no sale de la maquina, que es
   * el caso de desarrollo contra el contenedor de Docker.
   */
  if (process.env.BD_TLS === 'true') {
    configuracion.ssl = true;
  } else {
    configuracion.allowPublicKeyRetrieval = true;
  }

  return configuracion;
}
