import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './styles/global.css';
import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AnulacionesPage } from './features/anulaciones/AnulacionesPage';
import { CajaPage } from './features/caja/CajaPage';
import { ClientesPage } from './features/clientes/ClientesPage';
import { ConfiguracionPage } from './features/configuracion/ConfiguracionPage';
import { PanelPage } from './features/panel/PanelPage';
import { NuevoReciboPage } from './features/recibo/NuevoReciboPage';
import { ReciboPage } from './features/recibo/ReciboPage';
import { RecibosPage } from './features/recibos/RecibosPage';
import { ReportesPage } from './features/reportes/ReportesPage';
import { RequireAuth, RequireRole } from './layout/guards';
import { ShellLayout } from './layout/ShellLayout';
import { useSession } from './store/session';

/**
 * ARCA (cobro de las piscinas), montado en /cobro/* (23/10/2026). Conserva su
 * propio diseño y menú, como lo entregaron. Rutas relativas a /cobro.
 * Ya no tiene login, cambio de contraseña ni gestión de usuarios: eso es del
 * sistema (Mi cuenta y Seguridad > Usuarios).
 */
export default function ArcaApp() {
  const bootstrap = useSession((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <div className="arca-app">
      <Routes>
        <Route element={<RequireAuth />}>
          <Route element={<ShellLayout />}>
            <Route index element={<PanelPage />} />
            <Route path="recibos/nuevo" element={<NuevoReciboPage />} />
            <Route path="recibos" element={<RecibosPage />} />
            <Route path="recibos/:id" element={<ReciboPage />} />
            <Route path="anulaciones" element={<AnulacionesPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="caja" element={<CajaPage />} />
            <Route element={<RequireRole roles={['SUPERVISOR', 'ADMINISTRADOR']} />}>
              <Route path="reportes" element={<ReportesPage />} />
            </Route>
            <Route element={<RequireRole roles={['ADMINISTRADOR']} />}>
              <Route path="configuracion" element={<ConfiguracionPage />} />
              <Route path="catalogo" element={<Navigate to="/cobro/configuracion?seccion=tarifas" replace />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/cobro" replace />} />
      </Routes>
    </div>
  );
}
