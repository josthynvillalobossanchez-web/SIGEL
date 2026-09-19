(function(){
  var $=function(s,c){return (c||document).querySelector(s)},
      $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};

  /* ================= Tema claro / oscuro ================= */
  var raiz=document.documentElement;
  var LUNA='<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
  var SOL='<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  function leer(){try{return localStorage.getItem('sigel-tema')}catch(e){return null}}
  function guardar(v){try{localStorage.setItem('sigel-tema',v)}catch(e){}}
  function esOscuro(){
    var t=raiz.getAttribute('data-theme');
    if(t) return t==='dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function pintarTema(){
    var o=esOscuro();
    $$('.ico-tema, #icoTema').forEach(function(i){ i.innerHTML = o?SOL:LUNA; });
    $$('#btnTema, .btn-tema-acceso').forEach(function(b){
      b.setAttribute('aria-label', o?'Cambiar a tema claro':'Cambiar a tema oscuro');
      b.setAttribute('title', o?'Tema claro':'Tema oscuro');
    });
  }
  var g=leer(); if(g==='dark'||g==='light') raiz.setAttribute('data-theme',g);
  pintarTema();
  $$('#btnTema, .btn-tema-acceso').forEach(function(b){
    b.addEventListener('click',function(){
      var n=esOscuro()?'light':'dark'; raiz.setAttribute('data-theme',n); guardar(n); pintarTema();
    });
  });

  /* ================= Mostrar u ocultar contraseñas ================= */
  $$('[data-ver]').forEach(function(b){
    b.addEventListener('click',function(){
      var i=$('#'+b.dataset.ver);
      var oculta = i.type==='password';
      i.type = oculta ? 'text' : 'password';
      var t = oculta ? 'Ocultar contraseña' : 'Mostrar contraseña';
      b.setAttribute('aria-label',t); b.setAttribute('title',t);
    });
  });

  /* ================= Pantallas de acceso ================= */
  var vistas=['vLogin','vRecuperar','vPrimerIngreso'];
  function irVista(id){
    vistas.forEach(function(v){ $('#'+v).hidden = (v!==id); });
    $('#app').hidden = true; window.scrollTo(0,0);
  }
  function entrarApp(){
    vistas.forEach(function(v){ $('#'+v).hidden = true; });
    $('#app').hidden = false; window.scrollTo(0,0);
  }
  $$('[data-ir]').forEach(function(b){
    b.addEventListener('click',function(){ irVista(b.dataset.ir); reiniciarLogin(); });
  });

  /* ---- Inicio de sesión: 3 intentos y bloqueo de 3 minutos (Ficha 1) ---- */
  var fallos=0, temporizador=null;
  function reiniciarLogin(){
    fallos=0; clearInterval(temporizador);
    $('#msgLoginError').hidden=true; $('#msgBloqueo').hidden=true;
    $('#btnEntrar').disabled=false;
    $('#recPaso1').hidden=false; $('#recPaso2').hidden=true; $('#recPaso3').hidden=true;
  }
  function bloquear(){
    var restan=180;
    $('#msgLoginError').hidden=true; $('#msgBloqueo').hidden=false; $('#btnEntrar').disabled=true;
    function pintar(){ var m=Math.floor(restan/60),s=restan%60;
      $('#cuentaRegresiva').textContent=m+':'+(s<10?'0':'')+s; }
    pintar();
    temporizador=setInterval(function(){ restan--; pintar();
      if(restan<=0){ clearInterval(temporizador); reiniciarLogin(); } },1000);
  }
  $('#btnEntrar').addEventListener('click',function(){
    var u=$('#lgUsuario').value.trim().toLowerCase(), p=$('#lgPass').value;
    if(u && p){
      reiniciarLogin();
      if(u.indexOf('nueva')===0){ irVista('vPrimerIngreso'); return; }
      entrarApp(); abrirPagina('pgExpediente'); return;
    }
    fallos++;
    if(fallos>=3){ bloquear(); return; }
    $('#msgLoginError').hidden=false;
    $('#intentosRestantes').textContent=(3-fallos)===1?'1 intento':(3-fallos)+' intentos';
  });
  $('#btnGuardarPrimera').addEventListener('click',function(){ entrarApp(); abrirPagina('pgExpediente'); });
  $('#btnEnviarCodigo').addEventListener('click',function(){
    var c=$('#recCorreo').value.trim();
    if(c) $('#correoEnviado').textContent=c;
    $('#recPaso1').hidden=true; $('#recPaso2').hidden=false; $('#recPaso3').hidden=true;
    $('#recCodigo').focus();
  });
  $('#btnVolverPaso1').addEventListener('click',function(){
    $('#recPaso2').hidden=true; $('#recPaso1').hidden=false;
  });
  $('#btnOtroCodigo').addEventListener('click',function(){
    $('#recPaso2').hidden=true; $('#recPaso1').hidden=false; $('#recCorreo').focus();
  });
  $('#btnGuardarPassRec').addEventListener('click',function(){
    $('#recPaso2').hidden=true; $('#recPaso3').hidden=false;
  });
  $('#btnSalir').addEventListener('click',function(){ irVista('vLogin'); reiniciarLogin(); });

  /* ================= Navegación entre páginas ================= */
  function abrirPagina(id){
    $$('.pagina').forEach(function(p){ p.hidden = p.id!==id; });
    $$('.nav-item, .nav-sub-item').forEach(function(n){
      if(n.dataset.pagina===id) n.setAttribute('aria-current','page');
      else n.removeAttribute('aria-current');
    });
    // El padre queda marcado cuando se está en cualquiera de sus subsecciones
    if(id==='pgAltaFuncionario' || id==='pgExpediente'){
      var padre=$('#navFuncionarios');
      if(padre) padre.setAttribute('aria-current','true');
    }
    if(id==='pgAltaFuncionario') irPaso(1);
    cerrarMenuMovil(); window.scrollTo(0,0);
  }
  $$('.nav-item[data-pagina], .nav-sub-item[data-pagina]').forEach(function(n){
    n.addEventListener('click',function(){ abrirPagina(n.dataset.pagina); });
  });
  $$('[data-ir-pagina]').forEach(function(b){
    b.addEventListener('click',function(e){ e.preventDefault(); abrirPagina(b.dataset.irPagina); });
  });

  /* ================= Barra lateral ================= */
  var lateral=$('#lateral'), veloNav=$('#veloNav'), btnMenu=$('#btnMenu'),
      layout=$('#layout'), btnPlegar=$('#btnPlegar');
  function menuMovil(abrir){
    lateral.dataset.abierto=abrir?'si':'no';
    veloNav.dataset.abierto=abrir?'si':'no';
    btnMenu.setAttribute('aria-expanded',abrir?'true':'false');
  }
  function cerrarMenuMovil(){ menuMovil(false); }
  btnMenu.addEventListener('click',function(){ menuMovil(lateral.dataset.abierto!=='si'); });
  veloNav.addEventListener('click',cerrarMenuMovil);

  function plegar(oculto){
    layout.dataset.lateral = oculto ? 'oculto' : 'visible';
    btnPlegar.style.left = oculto ? '8px' : '236px';
    btnPlegar.querySelector('svg').style.transform = oculto ? 'rotate(180deg)' : 'none';
    btnPlegar.setAttribute('aria-expanded', oculto?'false':'true');
    var t = oculto ? 'Mostrar el menú lateral' : 'Ocultar el menú lateral';
    btnPlegar.setAttribute('title',t); btnPlegar.setAttribute('aria-label',t);
    try{ localStorage.setItem('sigel-lateral', oculto?'oculto':'visible'); }catch(e){}
  }
  btnPlegar.addEventListener('click',function(){
    plegar(layout.dataset.lateral!=='oculto');
  });
  try{ if(localStorage.getItem('sigel-lateral')==='oculto') plegar(true); }catch(e){}

  /* ================= Pestañas ================= */
  $$('.tab').forEach(function(t){
    t.addEventListener('click',function(){
      $$('.tab',t.parentNode).forEach(function(o){
        o.setAttribute('aria-selected','false');
        var pn=document.getElementById(o.dataset.panel); if(pn) pn.hidden=true;
      });
      t.setAttribute('aria-selected','true');
      var p=document.getElementById(t.dataset.panel); if(p) p.hidden=false;
    });
  });

  /* ================= Filtros de tabla (funcionan de verdad) ================= */
  $$('.filtros').forEach(function(grupo){
    var tabla = grupo.closest('.pagina').querySelector('tbody');
    $$('.filtro',grupo).forEach(function(f){
      f.addEventListener('click',function(){
        $$('.filtro',grupo).forEach(function(o){ o.setAttribute('aria-pressed','false'); });
        f.setAttribute('aria-pressed','true');
        var criterio=f.dataset.filtro||'todos', visibles=0;
        $$('tr',tabla).forEach(function(tr){
          var mostrar=true;
          if(criterio!=='todos'){
            var partes=criterio.split(':');
            mostrar = tr.dataset[partes[0]]===partes[1];
          }
          tr.hidden=!mostrar; if(mostrar) visibles++;
        });
        var vacio=grupo.closest('.pagina').querySelector('.vacio');
        if(vacio) vacio.hidden = visibles>0;
      });
    });
  });

  /* ================= Listas de selección (roles) ================= */
  $$('.item-sel').forEach(function(i){
    i.addEventListener('click',function(){
      $$('.item-sel',i.parentNode).forEach(function(o){ o.setAttribute('aria-pressed','false'); });
      i.setAttribute('aria-pressed','true');
    });
  });

  /* ================= Modales ================= */
  var ultimoFoco=null;
  function abrirModal(id){
    var m=document.getElementById(id); if(!m) return;
    ultimoFoco=document.activeElement;
    m.dataset.abierto='si';
    var f=m.querySelector('input:not([type=hidden]),select,textarea,button'); if(f) f.focus();
  }
  function cerrarModales(){
    $$('.velo').forEach(function(v){ v.dataset.abierto='no'; });
    if(ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }
  $$('[data-modal]').forEach(function(b){
    b.addEventListener('click',function(e){
      // Si el clic salió de un botón dentro de la fila, ese botón manda
      if(b.tagName==='TR' && e.target.closest('button')!==null && e.target.closest('button')!==b) return;
      abrirModal(b.dataset.modal);
    });
  });
  // Las filas también se abren con el teclado
  $$('tr[data-abrible]').forEach(function(tr){
    tr.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); abrirModal(tr.dataset.modal); }
    });
  });
  $$('[data-cerrar]').forEach(function(b){ b.addEventListener('click',cerrarModales); });
  $$('.velo').forEach(function(v){
    v.addEventListener('click',function(e){ if(e.target===v) cerrarModales(); });
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){ cerrarModales(); cerrarMenuMovil(); }
  });

  /* ---- El modal de usuario distingue crear de editar ---- */
  function prepararUsuario(esNuevo, nombre){
    $('#tUsuario').textContent = esNuevo ? 'Crear usuario' : 'Editar usuario';
    $('#subUsuario').textContent = esNuevo
      ? 'La contraseña inicial es temporal: el sistema obliga a cambiarla en el primer ingreso y avisa por correo.'
      : 'Cambie el correo de ingreso o los roles de ' + nombre + '. La contraseña no se puede ver ni cambiar desde aquí.';
    $('#campoPassTemp').hidden = !esNuevo;
    $('#btnUsGuardar').textContent = esNuevo ? 'Crear cuenta' : 'Guardar cambios';
    irPasoUs(1);
  }
  var filaUsuarioActiva=null;
  $$('[data-modal="mdUsuario"]').forEach(function(b){
    b.addEventListener('click',function(){
      var fila = b.closest('tr');
      filaUsuarioActiva = fila;
      if(fila){
        prepararUsuario(false, fila.querySelector('.nom').textContent);
        $('#usCorreo').value = fila.querySelector('.sec').textContent.trim();
      } else {
        prepararUsuario(true,''); $('#usCorreo').value='';
      }
    });
  });

  // Ver usuario: la fila completa abre solo lectura
  $$('[data-modal="mdVerUsuario"]').forEach(function(tr){
    tr.addEventListener('click',function(){
      filaUsuarioActiva = tr;
      $('#vuNombre').textContent = tr.querySelector('.nom').textContent;
      $('#vuCorreo').textContent = tr.querySelector('.sec').textContent.trim();
      $('#vuFuncionario').textContent = tr.querySelector('.nom').textContent;
      $('#vuEstado').innerHTML = tr.querySelector('.chip').outerHTML;
      $('#vuAcceso').textContent = tr.querySelector('[data-etiqueta="Último acceso"]').textContent.trim();
      $('#vuRoles').innerHTML = tr.querySelector('.pills').innerHTML;
    });
  });
  $('#btnEditarDesdeVer').addEventListener('click',function(){
    var fila = filaUsuarioActiva;
    cerrarModales();
    if(fila){
      prepararUsuario(false, fila.querySelector('.nom').textContent);
      $('#usCorreo').value = fila.querySelector('.sec').textContent.trim();
    }
    abrirModal('mdUsuario');
  });

  /* ---- Pasos dentro del modal de usuario ---- */
  function irPasoUs(n){
    $$('[data-panel-us]').forEach(function(p){ p.hidden = p.dataset.panelUs!==String(n); });
    $$('[data-paso-us]').forEach(function(p){
      if(p.dataset.pasoUs===String(n)) p.setAttribute('aria-current','step');
      else p.removeAttribute('aria-current');
      p.dataset.hecho = Number(p.dataset.pasoUs)<n ? 'si' : 'no';
    });
    $('#btnUsAtras').hidden = n===1;
    $('#btnUsAdelante').hidden = n===2;
    $('#btnUsGuardar').hidden = n!==2;
  }
  $('#btnUsAdelante').addEventListener('click',function(){ irPasoUs(2); });
  $('#btnUsAtras').addEventListener('click',function(){ irPasoUs(1); });
  $('#btnUsGuardar').addEventListener('click',cerrarModales);
  $$('[data-paso-us]').forEach(function(p){
    p.addEventListener('click',function(){ irPasoUs(Number(p.dataset.pasoUs)); });
  });

  /* ---- Clave del permiso que se va formando ---- */
  function pintarClave(){
    var m=$('#pwModulo').value||'módulo', a=$('#pwAccion').value||'acción';
    $('#clavePreview').textContent=m+'.'+a;
  }
  $('#pwModulo').addEventListener('change',pintarClave);
  $('#pwAccion').addEventListener('change',pintarClave);

  /* ---- Cambio de contraseña con código (Mi cuenta) ---- */
  $('#btnCpEnviar').addEventListener('click',function(){
    $('#cpPaso1').hidden=true; $('#cpPaso2').hidden=false;
    $('#subPass').textContent='Ingrese el código que le enviamos y defina su contraseña nueva.';
    $('#btnCpEnviar').hidden=true; $('#btnCpGuardar').hidden=false;
    $('#cpCodigo').focus();
  });
  $$('[data-modal="mdCambiarPass"]').forEach(function(b){
    b.addEventListener('click',function(){
      $('#cpPaso1').hidden=false; $('#cpPaso2').hidden=true;
      $('#subPass').textContent='Por seguridad, primero le enviamos un código de verificación al correo de su cuenta.';
      $('#btnCpEnviar').hidden=false; $('#btnCpGuardar').hidden=true;
    });
  });

  /* ================= Dar de baja documento (Ficha 42) ================= */
  $$('[data-baja]').forEach(function(b){
    b.addEventListener('click',function(){
      $('#modalDoc').textContent=b.dataset.baja; abrirModal('velo');
    });
  });

  /* ================= Subir documento (Ficha 19) ================= */
  var btnSubir=$('#btnSubir');
  if(btnSubir) btnSubir.addEventListener('click',function(){ abrirModal('mdSubir'); });
  var zona=$('#zonaArchivo');
  if(zona){
    zona.addEventListener('click',function(){
      $('#archivoElegido').hidden=false; zona.hidden=true;
    });
    $('#quitarArchivo').addEventListener('click',function(){
      $('#archivoElegido').hidden=true; zona.hidden=false;
    });
  }

  /* ================= Alta de funcionario por pasos (Ficha 11) ================= */
  var pasoActual=1, TOTAL=3;
  function irPaso(n){
    pasoActual=n;
    $$('[data-panel-paso]').forEach(function(p){ p.hidden = p.dataset.panelPaso!==String(n); });
    $$('[data-paso]').forEach(function(p){
      if(p.dataset.paso===String(n)) p.setAttribute('aria-current','step');
      else p.removeAttribute('aria-current');
      p.dataset.hecho = Number(p.dataset.paso)<n ? 'si' : 'no';
    });
    $('#numPaso').textContent=n;
    $('#btnPasoAtras').hidden = n===1;
    $('#btnPasoAdelante').hidden = n===TOTAL;
    $('#btnGuardarFunc').hidden = n!==TOTAL;
  }
  $$('[data-paso]').forEach(function(p){
    p.addEventListener('click',function(){ irPaso(Number(p.dataset.paso)); });
  });
  $('#btnPasoAdelante').addEventListener('click',function(){
    if(pasoActual===1 && !validarCedula()) return;
    irPaso(Math.min(TOTAL,pasoActual+1));
  });
  $('#btnPasoAtras').addEventListener('click',function(){ irPaso(Math.max(1,pasoActual-1)); });

  var cedulasUsadas=['2-0678-0432','2-0512-0908','2-0431-0177','2-0745-0219','2-0589-0664'];
  function validarCedula(){
    var ced=$('#fnCedula').value.trim();
    var repetida = cedulasUsadas.indexOf(ced)!==-1;
    $('#campoCedula').classList.toggle('error',repetida);
    $('#errCedula').hidden=!repetida;
    if(repetida) $('#fnCedula').focus();
    return !repetida;
  }
  $('#fnCedula').addEventListener('input',function(){
    $('#campoCedula').classList.remove('error'); $('#errCedula').hidden=true;
  });
  $('#btnGuardarFunc').addEventListener('click',function(){
    if(!validarCedula()){ irPaso(1); return; }
    abrirPagina('pgFuncionarios');
  });

  /* ================= Búsqueda de funcionarios (Ficha 14) ================= */
  var busca=$('#buscaFunc');
  if(busca) busca.addEventListener('input',function(){
    var q=busca.value.trim().toLowerCase(), visibles=0;
    $$('#tbodyFunc tr').forEach(function(tr){
      var hay = tr.textContent.toLowerCase().indexOf(q)!==-1;
      tr.hidden=!hay; if(hay) visibles++;
    });
    $('#sinResultados').hidden = visibles>0;
    $('#pagFunc').hidden = visibles===0;
  });

  /* ================= Vista RRHH / funcionaria ================= */
  var esRRHH=true, btnVista=$('#btnVista'), txtVista=$('#txtVista');
  function aplicarRol(){
    txtVista.textContent = esRRHH?'RRHH':'Funcionaria';
    $$('[data-rol="rrhh"]').forEach(function(el){ el.hidden=!esRRHH; });
    $$('[data-txt-rrhh]').forEach(function(el){
      el.textContent = esRRHH?el.dataset.txtRrhh:el.dataset.txtFunc;
    });
    $$('.solo-rrhh').forEach(function(el){ el.hidden=!esRRHH; });

    // Para la funcionaria no hay listado de funcionarios: su opción lleva a su expediente
    var navF=$('#navFuncionarios');
    navF.dataset.pagina = esRRHH ? 'pgFuncionarios' : 'pgExpediente';
    $('#subFuncionarios').hidden = !esRRHH;

    $('.usuario-inicial').textContent = esRRHH?'AV':'MR';
    $('.usuario-txt b').textContent = esRRHH?'Ana Lucía Vargas':'María José Rodríguez';
    $('.usuario-txt span').textContent = esRRHH?'Administrador · RRHH':'Solicitante · solo su expediente';
    $('#ctaCorreo').textContent = esRRHH?'avargas@munipalmares.go.cr':'mrodriguez@munipalmares.go.cr';
    $('#cpCorreo').textContent = esRRHH?'avargas@munipalmares.go.cr':'mrodriguez@munipalmares.go.cr';
    $('#perfilIniciales').textContent = esRRHH?'AV':'MR';
    $('#perfilNombre').textContent = esRRHH?'Ana Lucía Vargas Chaves':'María José Rodríguez Alfaro';
    $('#perfilIdent').textContent = esRRHH
      ? 'Cédula 2-0512-0908 · avargas@munipalmares.go.cr'
      : 'Cédula 2-0678-0432 · mrodriguez@munipalmares.go.cr';
    $('#perfilChips').innerHTML = esRRHH
      ? '<span class="chip chip-exito">● Cuenta activa</span><span class="chip-rol sistema">Administrador</span><span class="chip-rol sistema">Aprobador</span>'
      : '<span class="chip chip-exito">● Cuenta activa</span><span class="chip-rol sistema">Solicitante</span>';
    $('#perfilPuesto').textContent = esRRHH?'Jefa de Recursos Humanos':'Asistente de RRHH';
    $('#perfilIngreso').textContent = esRRHH?'12/01/2015':'03/02/2020';
    $('#ctaRoles').innerHTML = esRRHH
      ? '<span class="chip-rol sistema">Administrador</span><span class="chip-rol sistema">Aprobador</span>'
      : '<span class="chip-rol sistema">Solicitante</span>';

    $('#migaLista').hidden=!esRRHH;
    $('#migaSep').hidden=!esRRHH;
    $('#migaNombre').textContent = esRRHH?'María José Rodríguez Alfaro':'Mi expediente';

    if(!esRRHH){
      var visible=$$('.pagina').filter(function(p){ return !p.hidden; })[0];
      if(visible && visible.id!=='pgExpediente' && visible.id!=='pgCuenta') abrirPagina('pgExpediente');
    }
  }
  btnVista.addEventListener('click',function(){ esRRHH=!esRRHH; aplicarRol(); });

  /* ================= Estado inicial ================= */
  aplicarRol(); irPaso(1); irPasoUs(1); pintarClave();
  irVista('vLogin');
})();
