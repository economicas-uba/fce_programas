/* =========================================================
   Programas Académicos — simulación de operación real
   Persistencia: ver persistencia.js — API PHP del servidor (api/)
   cuando está disponible; si no, localStorage del navegador.

   Máquina de estados de un programa:
     BORRADOR
       -> (Titular solicita conformidad) -> EN_REVISION
       -> (Director rechaza / Dirección Académica o
          Subsecretaría solicitan corrección) <- vuelve aquí
     EN_REVISION  (esperando conformidad del Director/a de depto.)
       -> aprueba -> EN_REVISION_ACADEMICA
       -> rechaza -> BORRADOR (origenCorreccion='DIRECTOR')
     EN_REVISION_ACADEMICA (chequeos en paralelo e independientes)
       - encuadre      -> Dirección Académica
       - metodos       -> Subsecretaría_1
       - bibliografia  -> Subsecretaría_2
       -> los 3 OK -> APROBADO (nota de elevación + expediente GEDO)
       -> cualquiera con errores -> BORRADOR (origenCorreccion='ACADEMICA',
          y al reenviar se reinician los 3 chequeos, sin pasar de nuevo
          por el Director — según lo definido para este circuito)
     APROBADO (fin del proceso)
   ========================================================= */

const STORAGE_KEY='pa_mock_data_v2';

/* ---------- Alertas centradas (reemplazan al alert nativo del navegador) ---------- */
const colaAlertas=[]; let alertaAbierta=false;
function mostrarAlerta(mensaje,alCerrar){
  colaAlertas.push({mensaje:String(mensaje==null?'':mensaje),alCerrar});
  if(!alertaAbierta) abrirSiguienteAlerta();
}
function abrirSiguienteAlerta(){
  const item=colaAlertas.shift();
  if(!item){ alertaAbierta=false; return; }
  alertaAbierta=true;
  const overlay=document.createElement('div');
  overlay.className='alert-overlay';
  overlay.setAttribute('role','alertdialog'); overlay.setAttribute('aria-modal','true');
  const box=document.createElement('div'); box.className='alert-box';
  const msg=document.createElement('p'); msg.className='alert-msg'; msg.textContent=item.mensaje;
  const btn=document.createElement('button'); btn.type='button'; btn.className='btn primary'; btn.textContent='Aceptar';
  let cerrado=false;
  function cerrar(){
    if(cerrado) return; cerrado=true;
    document.removeEventListener('keydown',onKey,true);
    overlay.remove();
    if(item.alCerrar) item.alCerrar();
    abrirSiguienteAlerta();
  }
  function onKey(e){ if(e.key==='Escape'||e.key==='Enter'){ e.preventDefault(); e.stopPropagation(); cerrar(); } }
  btn.addEventListener('click',cerrar);
  document.addEventListener('keydown',onKey,true);
  box.appendChild(msg); box.appendChild(btn); overlay.appendChild(box); document.body.appendChild(overlay);
  btn.focus();
}
window.alert=function(mensaje){ mostrarAlerta(mensaje); };

/* Diálogo de confirmación centrado: el botón principal ejecuta la acción y Cancelar solo cierra el diálogo.
   El foco inicial queda en Cancelar para que un Enter accidental no confirme acciones irreversibles. */
function confirmarAccion(mensaje,textoOk,alConfirmar){
  const overlay=document.createElement('div');
  overlay.className='alert-overlay';
  overlay.setAttribute('role','alertdialog'); overlay.setAttribute('aria-modal','true');
  const box=document.createElement('div'); box.className='alert-box';
  const msg=document.createElement('p'); msg.className='alert-msg'; msg.textContent=mensaje;
  const acciones=document.createElement('div'); acciones.className='alert-actions';
  const ok=document.createElement('button'); ok.type='button'; ok.className='btn primary'; ok.textContent=textoOk;
  const cancelar=document.createElement('button'); cancelar.type='button'; cancelar.className='btn'; cancelar.textContent='Cancelar';
  let cerrado=false;
  function cerrar(){
    if(cerrado) return false; cerrado=true;
    document.removeEventListener('keydown',onKey,true);
    overlay.remove();
    return true;
  }
  function onKey(e){ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); cerrar(); } }
  ok.addEventListener('click',()=>{ if(cerrar()) alConfirmar(); });
  cancelar.addEventListener('click',cerrar);
  document.addEventListener('keydown',onKey,true);
  acciones.appendChild(ok); acciones.appendChild(cancelar);
  box.appendChild(msg); box.appendChild(acciones); overlay.appendChild(box); document.body.appendChild(overlay);
  cancelar.focus();
}

const SECTION_DEFS=[
 {key:'contenidosMinimos',label:'Contenidos mínimos',sectionTitle:'A. Encuadre',locked:true,reviewGroup:'encuadre'},
 {key:'razonesInclusion',label:'Razones que justifican la inclusión de la asignatura dentro del plan de estudios. Su importancia en la formación profesional',sectionTitle:'A. Encuadre',locked:false,reviewGroup:'encuadre'},
 {key:'ubicacionCurriculum',label:'Ubicación de la asignatura en el currículum',sectionTitle:'A. Encuadre',locked:true,reviewGroup:'encuadre'},
 {key:'objetivosAprendizaje',label:'Objetivos del aprendizaje (Misión de la asignatura)',sectionTitle:'A. Encuadre',locked:false,reviewGroup:'encuadre'},
 {key:'programaAnalitico',label:'Programa analítico',sectionTitle:'B. Programa analítico',locked:false,reviewGroup:null},
 {key:'bibliografiaObligatoria',label:'Bibliografía obligatoria',sectionTitle:'C. Bibliografía',locked:false,reviewGroup:'bibliografia'},
 {key:'bibliografiaAmpliatoria',label:'Bibliografía ampliatoria',sectionTitle:'C. Bibliografía',locked:false,reviewGroup:'bibliografia'},
 {key:'objetivosGeneralesCursos',label:'Objetivos generales a cumplir en los cursos de promoción',sectionTitle:'D. Métodos de conducción del aprendizaje',locked:false,reviewGroup:'metodos'},
 {key:'metodologiaProceso',label:'Metodología del proceso enseñanza - aprendizaje',sectionTitle:'D. Métodos de conducción del aprendizaje',locked:false,reviewGroup:'metodos'},
 {key:'dinamicaClases',label:'Dinámica del dictado de las clases',sectionTitle:'D. Métodos de conducción del aprendizaje',locked:false,reviewGroup:'metodos'},
 {key:'evaluacionPresenciales',label:'Cursos presenciales y semipresenciales (cursos virtuales y a distancia)',sectionTitle:'E. Métodos de evaluación',locked:false,reviewGroup:'metodos'},
 {key:'evaluacionFinales',label:'Régimen de exámenes finales, intensivos, magistrales y libres',sectionTitle:'E. Métodos de evaluación',locked:false,reviewGroup:'metodos'},
 {key:'criterioPromedio',label:'Criterio de confección del promedio de notas finales',sectionTitle:'E. Métodos de evaluación',locked:false,reviewGroup:'metodos'}
];

const EDITABLE_KEYS=SECTION_DEFS.filter(s=>!s.locked).map(s=>s.key);
const REVIEW_GROUP_BY_ROLE={DIRECCION_ACADEMICA:'encuadre',SUBSECRETARIA_1:'metodos',SUBSECRETARIA_2:'bibliografia'};
const GROUP_LABELS={encuadre:'Encuadre',metodos:'Métodos de conducción y de evaluación',bibliografia:'Bibliografía'};

const roleNames={
 TITULAR_CATEDRA:'Titular de cátedra',
 SUBSECRETARIA_1:'Subsecretaría_1',
 SUBSECRETARIA_2:'Subsecretaría_2',
 DIRECCION_ACADEMICA:'Dirección Académica',
 DIRECTOR_DEPARTAMENTO:'Director/a de Departamento'
};

let role='TITULAR_CATEDRA';
let db=loadData();
let programaAnaliticoActualId=null;

/* =========================================================
   Usuarios, roles y alcance
   - El flujo del programa sigue definido por ROLES (estados y tareas).
   - Las personas (usuarios) tienen uno o más roles. Cada rol tiene un ámbito:
       CATEDRA       -> el titular de la cátedra (titular_id del programa)
       DEPARTAMENTO  -> programas cuyo departamento_id está en su alcance
       GLOBAL        -> todos los programas
   - Una tarea se deriva a todos los usuarios elegibles (rol + alcance).
     Si hay más de uno, hay que "tomarla": los demás la ven como "Tomada por X".
   ========================================================= */
/* Con un servidor (o GitHub Pages) se leen estos JSON. Abriendo el HTML con doble clic (file://)
   el navegador bloquea la lectura de archivos locales y se usa la copia de datos/datos-prueba.js. */
const USUARIOS_JSON_URL='datos/usuarios.json';
const MATERIAS_JSON_URL='datos/materias.json';
const LOGIN_PASS='Prueba';
const AMBITO_POR_DEFECTO={TITULAR_CATEDRA:'CATEDRA',DIRECTOR_DEPARTAMENTO:'DEPARTAMENTO',SUBSECRETARIA_1:'GLOBAL',SUBSECRETARIA_2:'GLOBAL',DIRECCION_ACADEMICA:'GLOBAL'};
const PRIORIDAD_ROLES=['TITULAR_CATEDRA','DIRECTOR_DEPARTAMENTO','DIRECCION_ACADEMICA','SUBSECRETARIA_1','SUBSECRETARIA_2'];
const ROL_POR_GRUPO={encuadre:'DIRECCION_ACADEMICA',metodos:'SUBSECRETARIA_1',bibliografia:'SUBSECRETARIA_2'};
const TAREAS={
 COMPLETAR_PROGRAMA:{rol:'TITULAR_CATEDRA',titulo:'Completar programa',accion:'Continuar',cls:'primary'},
 CORREGIR_PROGRAMA:{rol:'TITULAR_CATEDRA',titulo:'Corregir programa',accion:'Corregir',cls:'warn'},
 DAR_CONFORMIDAD:{rol:'DIRECTOR_DEPARTAMENTO',titulo:'Dar conformidad',accion:'Revisar',cls:'primary'},
 CHEQUEAR_ENCUADRE:{rol:'DIRECCION_ACADEMICA',titulo:'Chequear Encuadre',accion:'Revisar',cls:'primary'},
 CHEQUEAR_METODOS:{rol:'SUBSECRETARIA_1',titulo:'Chequear Métodos de conducción y de evaluación',accion:'Revisar',cls:'primary'},
 CHEQUEAR_BIBLIOGRAFIA:{rol:'SUBSECRETARIA_2',titulo:'Chequear Bibliografía',accion:'Revisar',cls:'primary'},
 COMPLETAR_RESOLUCION:{rol:'DIRECCION_ACADEMICA',titulo:'Completar Resolución',descripcion:'Completar Resolución',accion:'Ver',cls:'primary'},
 NOTIFICARSE:{rol:'DIRECTOR_DEPARTAMENTO',titulo:'Se solicita su notificación',descripcion:'Programa con número de resolución asignado',accion:'Notificarse',cls:'primary',directa:'notificarseResolucion'}
};
let directorio={roles:[],usuarios:[]};
let fuenteDirectorio='';
let directorioPromise=null;
let usuarioActual=null;
let catalogoMaterias={departamentos:[],carreras:[]};

function leerJson(url,clave){
  return Promise.resolve().then(()=>fetch(url))
    .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json().then(datos=>({datos,fuente:url})); })
    .catch(err=>{
      const respaldo=window.DATOS_PRUEBA && window.DATOS_PRUEBA[clave];
      if(respaldo){ console.warn('Se usa la copia embebida de "'+clave+'" ('+err.message+')'); return {datos:respaldo,fuente:'copia embebida (datos/datos-prueba.js)'}; }
      throw err;
    });
}
function cargarDirectorio(){
  if(directorioPromise) return directorioPromise;
  directorioPromise=leerJson(Persistencia.urlCatalogo('usuarios',USUARIOS_JSON_URL),'usuarios').then(({datos,fuente})=>{
    directorio={roles:Array.isArray(datos.roles)?datos.roles:[],usuarios:Array.isArray(datos.usuarios)?datos.usuarios:[]};
    fuenteDirectorio=fuente;
    return directorio;
  }).catch(err=>{ directorioPromise=null; console.error('No se pudo cargar usuarios.json',err); throw err; });
  return directorioPromise;
}

function nombreCompleto(u){ return `${u.nombre||''} ${u.apellido||''}`.trim()||u.email||u.id; }
/* Nombre con el que se muestra un rol: el del JSON (roles[].nombre); si falta, el de roleNames; solo como último recurso, el id. */
function nombreRol(id){ const r=directorio.roles.find(x=>x.id===id); return (r&&r.nombre)||roleNames[id]||id; }
function ambitoDeRol(rol){ const r=directorio.roles.find(x=>x.id===rol); return (r&&r.ambito)||AMBITO_POR_DEFECTO[rol]||'GLOBAL'; }
function asignacionVigente(a){ const hoy=new Date().toISOString().slice(0,10); return (!a.desde||a.desde<=hoy)&&(!a.hasta||a.hasta>=hoy); }
function asignacionesDe(u,rol){ return ((u&&u.roles)||[]).filter(a=>a.rol===rol&&asignacionVigente(a)); }
function rolesActivosDe(u){ if(!u||u.activo===false) return []; return [...new Set((u.roles||[]).filter(asignacionVigente).map(a=>a.rol))]; }
function tieneRol(rol){ return rolesActivosDe(usuarioActual).includes(rol); }
/* ¿El rol `rol` del usuario `u` alcanza al programa `p`? */
function usuarioAlcanza(u,rol,p){
  if(!u||!p||u.activo===false) return false;
  const asig=asignacionesDe(u,rol);
  if(!asig.length) return false;
  const ambito=ambitoDeRol(rol);
  if(ambito==='GLOBAL') return true;
  if(ambito==='DEPARTAMENTO') return !!p.departamento_id && asig.some(a=>((a.alcance&&a.alcance.departamentos)||[]).includes(p.departamento_id));
  if(ambito==='CATEDRA') return !!p.titular_id && p.titular_id===u.id;
  return false;
}
/* Tareas que el titular de la cátedra no puede hacer sobre su propio programa (no hay autoconformidad). */
const TAREAS_SIN_TITULAR=['DAR_CONFORMIDAD'];
function excluidoPorTitular(u,codigo,p){ return !!(u&&p&&TAREAS_SIN_TITULAR.includes(codigo)&&p.titular_id&&p.titular_id===u.id); }
/* ¿Puede el usuario `u` realizar la tarea `codigo` sobre el programa `p`? Rol + alcance + exclusiones de la tarea. */
function usuarioPuedeTarea(u,codigo,p){ return !!TAREAS[codigo] && usuarioAlcanza(u,TAREAS[codigo].rol,p) && !excluidoPorTitular(u,codigo,p); }
function usuariosElegibles(rol,p){ return directorio.usuarios.filter(u=>usuarioAlcanza(u,rol,p)); }
function usuariosElegiblesTarea(codigo,p){ return directorio.usuarios.filter(u=>usuarioPuedeTarea(u,codigo,p)); }
function usuariosConRol(rol){ return directorio.usuarios.filter(u=>rolesActivosDe(u).includes(rol)); }
function programasVisibles(){
  const u=usuarioActual; if(!u) return [];
  const roles=rolesActivosDe(u);
  return db.programs.filter(p=>roles.some(r=>usuarioAlcanza(u,r,p)));
}

/* ---------- Tareas derivadas del estado del programa ---------- */
function tareasPendientesDePrograma(p){
  const r=[];
  if(p.state==='BORRADOR') r.push(p.origenCorreccion?'CORREGIR_PROGRAMA':'COMPLETAR_PROGRAMA');
  if(p.state==='EN_REVISION') r.push('DAR_CONFORMIDAD');
  if(p.state==='EN_REVISION_ACADEMICA' && p.revisionAcademica){
    ['encuadre','metodos','bibliografia'].forEach(g=>{ if(p.revisionAcademica[g] && p.revisionAcademica[g].status==='PENDIENTE') r.push('CHEQUEAR_'+g.toUpperCase()); });
  }
  if(p.state==='APROBADO' && !p.resolucion) r.push('COMPLETAR_RESOLUCION');
  if(p.state==='FINALIZADO' && tieneResolucion(p) && !p.directorNotificado) r.push('NOTIFICARSE');
  return r;
}
function codigoTareaDelRol(p,rol){ return tareasPendientesDePrograma(p).find(c=>TAREAS[c].rol===rol)||null; }
/* Estado de una tarea: con un solo elegible queda tomada por él; con varios, hay que tomarla. */
function estadoTarea(p,codigo){
  const elegibles=usuariosElegiblesTarea(codigo,p);
  if(elegibles.length===1) return {estado:'TOMADA',tomadaPor:elegibles[0],implicita:true};
  const t=(db.tomas||[]).find(x=>x.programa_id===p.id && x.tarea===codigo);
  if(t){
    const dueno=elegibles.find(e=>e.id===t.tomada_por);
    if(dueno) return {estado:'TOMADA',tomadaPor:dueno,implicita:false};
  }
  return {estado:'DISPONIBLE',tomadaPor:null,implicita:false};
}
function tareasDeUsuario(u){
  const items=[];
  db.programs.forEach(p=>{
    tareasPendientesDePrograma(p).forEach(codigo=>{
      const def=TAREAS[codigo];
      if(!usuarioPuedeTarea(u,codigo,p)) return;
      const e=estadoTarea(p,codigo);
      const mia=e.estado==='TOMADA' && e.tomadaPor.id===u.id;
      items.push({p,codigo,rol:def.rol,tarea:def.titulo,descripcion:def.descripcion||def.titulo,accionLabel:def.accion,cls:def.cls,directa:def.directa||null,
        estado:e.estado==='DISPONIBLE'?'DISPONIBLE':(mia?'MIA':'OTRO'),tomadaPor:e.tomadaPor,implicita:e.implicita});
    });
  });
  return items;
}
/* El usuario puede actuar si la tarea sigue pendiente, le corresponde y la tiene tomada. */
function puedeActuar(p,codigo){
  const u=usuarioActual;
  if(!p||!u||!codigo||!TAREAS[codigo]) return false;
  if(!tareasPendientesDePrograma(p).includes(codigo)) return false;
  if(!usuarioPuedeTarea(u,codigo,p)) return false;
  const e=estadoTarea(p,codigo);
  return e.estado==='TOMADA' && e.tomadaPor.id===u.id;
}
function avisoNoPuedeActuar(p,codigo,rol){
  if(!usuarioActual || !codigo || !tareasPendientesDePrograma(p).includes(codigo)) return 'Esta tarea ya no está pendiente.';
  if(excluidoPorTitular(usuarioActual,codigo,p)) return 'Sos titular de esta cátedra: la conformidad la tiene que dar otro/a Director/a del mismo departamento.';
  if(!usuarioAlcanza(usuarioActual,rol||TAREAS[codigo].rol,p)) return 'No tenés permisos para actuar sobre este programa con ese rol.';
  const e=estadoTarea(p,codigo);
  if(e.estado==='DISPONIBLE') return 'Tomá la tarea antes de actuar sobre el programa.';
  return `La tarea fue tomada por ${nombreCompleto(e.tomadaPor)}.`;
}
function exigirTarea(p,rol,codigo){
  codigo=codigo||codigoTareaDelRol(p,rol);
  if(puedeActuar(p,codigo)) return codigo;
  alert(avisoNoPuedeActuar(p,codigo,rol));
  return null;
}
function refrescarPantalla(){
  const activa=document.querySelector('.nav button.active');
  render(activa?activa.dataset.screen:'dashboard');
}
function tomarTarea(programaId,codigo,enPrograma){
  const p=getProgram(programaId), u=usuarioActual;
  if(!p||!u||!TAREAS[codigo]) return;
  const salir=()=>enPrograma?openProgram(programaId):refrescarPantalla();
  if(!tareasPendientesDePrograma(p).includes(codigo) || !usuarioPuedeTarea(u,codigo,p)){ alert(excluidoPorTitular(u,codigo,p)?avisoNoPuedeActuar(p,codigo):'La tarea ya no está disponible.'); salir(); return; }
  const e=estadoTarea(p,codigo);
  if(e.estado==='TOMADA'){
    if(e.tomadaPor.id!==u.id) alert(`La tarea ya fue tomada por ${nombreCompleto(e.tomadaPor)}.`);
    salir(); return;
  }
  db.tomas=db.tomas||[];
  db.tomas.push({programa_id:p.id,tarea:codigo,rol:TAREAS[codigo].rol,tomada_por:u.id,fecha:new Date().toISOString()});
  addHistory(p,nombreRol(TAREAS[codigo].rol),`Toma la tarea "${TAREAS[codigo].titulo}"`,'');
  save();
  salir();
}
function liberarTarea(programaId,codigo,enPrograma){
  const p=getProgram(programaId), u=usuarioActual;
  if(!p||!u||!TAREAS[codigo]) return;
  const t=(db.tomas||[]).find(x=>x.programa_id===p.id && x.tarea===codigo && x.tomada_por===u.id);
  if(t){
    db.tomas=db.tomas.filter(x=>x!==t);
    addHistory(p,nombreRol(TAREAS[codigo].rol),`Libera la tarea "${TAREAS[codigo].titulo}"`,'');
    save();
  }
  enPrograma?openProgram(programaId):refrescarPantalla();
}
/* Rol con el que se muestra un programa: el que tiene una tarea del usuario sobre él o, si no, uno que lo alcance. */
function ajustarRolParaPrograma(p,preferido){
  const u=usuarioActual; if(!u||!p) return;
  const roles=rolesActivosDe(u).filter(r=>usuarioAlcanza(u,r,p));
  if(!roles.length) return;
  if(preferido && roles.includes(preferido)){ role=preferido; return; }
  const propias=tareasDeUsuario(u).filter(it=>it.p.id===p.id);
  const elegida=(propias.find(it=>it.estado==='MIA')||propias.find(it=>it.estado==='DISPONIBLE')||{}).rol;
  if(elegida){ role=elegida; return; }
  if(roles.includes(role)) return;
  role=PRIORIDAD_ROLES.find(r=>roles.includes(r))||roles[0];
}
function abrirTarea(id,rol){ openProgram(id,rol); }
function rolesProgramaHtml(p){
  const u=usuarioActual; if(!u) return '';
  const roles=rolesActivosDe(u).filter(r=>usuarioAlcanza(u,r,p));
  if(roles.length<=1) return `<p class="muted" style="margin:4px 0 0">Participás como: ${escapeHtml(nombreRol(role))}</p>`;
  return `<p class="muted" style="margin:4px 0 0">Participás como: ${roles.map(r=>`<button type="button" class="btn small ${r===role?'primary':''}" onclick="openProgram(${p.id},'${r}')">${escapeHtml(nombreRol(r))}</button>`).join(' ')}</p>`;
}
/* Mensaje (y botón para tomar) cuando el usuario todavía no puede actuar sobre una tarea. */
function bloqueoTarea(p,codigo){
  if(!codigo || puedeActuar(p,codigo)) return '';
  const def=TAREAS[codigo], e=estadoTarea(p,codigo);
  const rolLabel=escapeHtml(nombreRol(def.rol));
  if(excluidoPorTitular(usuarioActual,codigo,p)){
    const otros=usuariosElegiblesTarea(codigo,p);
    return `<div class="card"><h2>${escapeHtml(def.titulo)}</h2><p>Sos titular de esta cátedra, por lo que no podés dar conformidad a tu propio programa. La tarea queda para ${otros.length?'otro/a '+rolLabel+' del mismo departamento'+(e.estado==='TOMADA'?` (tomada por <b>${escapeHtml(nombreCompleto(e.tomadaPor))}</b>)`:''):'otro/a '+rolLabel+' del mismo departamento, pero no hay ninguno/a asignado/a'}.</p></div>`;
  }
  if(e.estado==='DISPONIBLE') return `<div class="card"><h2>${escapeHtml(def.titulo)}</h2><p>Esta tarea la puede realizar cualquiera de los usuarios con el rol ${rolLabel}. Tomala para poder actuar sobre el programa.</p><button class="btn primary" onclick="tomarTarea(${p.id},'${codigo}',true)">Tomar tarea</button></div>`;
  if(e.estado==='TOMADA' && e.tomadaPor && usuarioActual && e.tomadaPor.id!==usuarioActual.id) return `<div class="card"><h2>${escapeHtml(def.titulo)}</h2><p>Tarea tomada por <b>${escapeHtml(nombreCompleto(e.tomadaPor))}</b> (${rolLabel}). Podés ver el programa, pero no actuar sobre esta tarea.</p></div>`;
  return '';
}
function tareasTomadasHtml(p){
  if(!usuarioActual) return '';
  const mias=tareasDeUsuario(usuarioActual).filter(it=>it.p.id===p.id && it.estado==='MIA' && !it.implicita);
  if(!mias.length) return '';
  return `<div class="card"><h2>Tareas que tomaste</h2>${mias.map(it=>`<p style="margin:6px 0">${escapeHtml(it.tarea)} <button class="btn small" onclick="liberarTarea(${p.id},'${it.codigo}',true)">Liberar tarea</button></p>`).join('')}</div>`;
}

/* ---------- Datos guardados de versiones anteriores ---------- */
function aplicarCatedra(p,m){
  p.catedra_id=m.catedra_id||null; p.departamento_id=m.departamento_id||null;
  p.carrera_ids=m.carrera_ids||[]; p.titular_id=m.titular_id||null;
}
function migrarDatos(){
  let cambio=false;
  const norm=x=>String(x||'').trim().toLowerCase();
  db.programs.forEach(p=>{
    if(!p.catedra_id && materiasCache){
      const m=materiasCache.find(x=>x.catedra_id && norm(x.nombre_materia)===norm(p.nombre_materia||p.name) && norm(x.titular)===norm(p.titular));
      if(m){ aplicarCatedra(p,m); cambio=true; }
    }
  });
  (db.notificaciones||[]).forEach(n=>{
    if(!Array.isArray(n.usuarios)){
      const p=getProgram(n.programaId), ids=[];
      if((n.roles||[]).includes('DIRECCION_ACADEMICA')) usuariosConRol('DIRECCION_ACADEMICA').forEach(u=>ids.push(u.id));
      if((n.roles||[]).includes('TITULAR_CATEDRA') && p && p.titular_id) ids.push(p.titular_id);
      n.usuarios=[...new Set(ids)]; delete n.roles; cambio=true;
    }
  });
  if(cambio) saveData(db);
}

/* ---------- Persistencia ---------- */
/* Modo local: localStorage. Modo API: el estado se trae del servidor al ingresar (ver enterApp). */
function loadData(){
 if(Persistencia.esApi()) return seedData();
 const guardado=Persistencia.leerLocal();
 if(guardado) return guardado;
 const seed=seedData();
 Persistencia.guardar(seed);
 return seed;
}
function saveData(data){
 Persistencia.guardar(data,usuarioActual?usuarioActual.id:null);
}
/* Ante un error al guardar en el servidor se avisa y se recargan sus datos, para no seguir sobre un estado distinto. */
function recargarDesdeServidor(){
 return Persistencia.refrescar().then(d=>{ if(d){ db=d; migrarDatos(); } refrescarPantalla(); })
   .catch(err=>alert('No se pudieron recargar los datos del servidor: '+err.message));
}
Persistencia.configurar({
 obtenerDb:()=>db,
 alFallar:err=>{
   if(err.status===401){ mostrarAlerta('La sesión venció. Volvé a ingresar.',()=>salir()); return; }
   const motivo=err.status===409?(err.message+' Se recargan los datos actualizados.'):('No se pudieron guardar los cambios en el servidor: '+err.message+'. Se recargan los datos del servidor.');
   mostrarAlerta(motivo,()=>recargarDesdeServidor());
 }
});
/* Las tomas de tareas ya resueltas se descartan. */
function limpiarTomas(){
  if(!Array.isArray(db.tomas)||!db.tomas.length) return;
  const vivas=db.tomas.filter(t=>{ const p=getProgram(t.programa_id); return p && tareasPendientesDePrograma(p).includes(t.tarea); });
  if(vivas.length!==db.tomas.length) db.tomas=vivas;
}
function save(){ limpiarTomas(); saveData(db); actualizarCampanas(); }

/* ---------- Campanas de novedades (Tareas / Notificaciones), por usuario ---------- */
function claveTareas(){ return taskSummary().pendientes.map(it=>it.p.id+'|'+it.codigo); }
function claveNotificaciones(){
  const u=usuarioActual;
  return taskSummary().pendientes.map(it=>'t'+it.p.id+'|'+it.codigo)
    .concat(u?(db.notificaciones||[]).filter(n=>(n.usuarios||[]).includes(u.id)).map(n=>'n'+n.id):[]);
}
/* La primera vez que un usuario entra, todo lo existente se toma como ya visto en Notificaciones. */
function vistosDelUsuario(){
  const id=usuarioActual?usuarioActual.id:'_sin_usuario';
  db.vistos=db.vistos||{};
  if(!db.vistos[id] || !Array.isArray(db.vistos[id].notificaciones)){ db.vistos[id]={notificaciones:claveNotificaciones()}; saveData(db); }
  return db.vistos[id];
}
/* Al entrar a Notificaciones todo lo que se lista queda como visto y la campana se apaga. Tareas no se marca: depende de que haya tareas pendientes. */
function marcarVisto(pantalla){
  if(pantalla!=='notifications' || !usuarioActual) return;
  const v=vistosDelUsuario();
  v.notificaciones=claveNotificaciones();
  saveData(db);
}
function actualizarCampanas(){
  const mostrar=(id,flag)=>{ const e=document.getElementById(id); if(e) e.hidden=!flag; };
  if(!usuarioActual){ mostrar('campanaTareas',false); mostrar('campanaNotificaciones',false); return; }
  const v=vistosDelUsuario(), kt=claveTareas(), kn=claveNotificaciones();
  /* Lo que ya no existe se descarta: si un aviso vuelve a generarse, se considera nuevo. */
  const vn=v.notificaciones.filter(k=>kn.includes(k));
  if(vn.length!==v.notificaciones.length){ v.notificaciones=vn; saveData(db); }
  /* Tareas: la campana está encendida mientras quede al menos una tarea pendiente y se apaga cuando se completan todas. */
  mostrar('campanaTareas',kt.length>0);
  /* Notificaciones: se enciende con un aviso o notificación nueva y se apaga al entrar a la solapa. */
  mostrar('campanaNotificaciones',kn.some(k=>!vn.includes(k)));
}
function reiniciarDatos(){
 if(Persistencia.esApi()){
   if(!confirm('Esto borra en el SERVIDOR todos los programas, tareas y notificaciones de TODOS los usuarios de prueba. ¿Continuar?')) return;
   Persistencia.reiniciar().then(d=>{ db=d; render('dashboard'); }).catch(err=>alert(err.message));
   return;
 }
 if(!confirm('Esto borra los cambios simulados y vuelve a los datos de ejemplo iniciales. ¿Continuar?')) return;
 db=seedData(); save(); render('dashboard');
}

function crearProgramaBase(id,name,career,year){
  return {
   id,name,career,year,state:'BORRADOR',origenCorreccion:null,
   sections:{
    contenidosMinimos:{content:'Contenidos mínimos de la materia. No pueden modificarse.',completed:true},
    razonesInclusion:{content:'',completed:false},
    ubicacionCurriculum:{content:'Ubicación de la asignatura en el currículum. No puede modificarse.',completed:true},
    objetivosAprendizaje:{content:'',completed:false},
    programaAnalitico:{unidades:[],unidadTematica:'',objetivoAprendizaje:'',temasDesarrollar:'',content:'',completed:false},
    bibliografiaObligatoria:{content:'',completed:false},
    bibliografiaAmpliatoria:{content:'',completed:false},
    objetivosGeneralesCursos:{content:'',completed:false},
    metodologiaProceso:{content:'',completed:false},
    dinamicaClases:{content:'',completed:false},
    evaluacionPresenciales:{content:'Los alumnos serán evaluados, como mínimo, con dos exámenes escritos –en días y horarios de clase- (Resolución CD 386/2006) que contemplarán aspectos teóricos y prácticos de la asignatura. Se destaca que solo serán examinados los alumnos regulares e inscriptos en cada curso.',completed:false},
    evaluacionFinales:{content:'El examen final integrador comprenderá temas teóricos y prácticos de la asignatura, debiendo el alumno aprobar ambos temarios, para que su calificación resulte promediada, con un puntaje que alcance por lo menos un 60% de los contenidos. Por consiguiente, los alumnos que obtengan una calificación inferior a 4 (cuatro) puntos serán considerados insuficientes y aquellos con una calificación igual o superior a 4 (cuatro) aprobarán la asignatura con dicha nota (Resolución CD 406/2006).',completed:false},
    criterioPromedio:{content:'En los casos en que fuere necesario expresar en número entero el promedio de notas parciales o de estas y el examen parcial, se aplicará el número entero superior si la fracción fuere de 0.50 puntos o más y el número entero inferior si fuere de 0.49 o menos. Cuando la nota fuese de 3.01 a 3.99 se calificará con 3 (tres) puntos. (Resolución CS 4994/93)',completed:false}
   },
   conformidadDirector:null,
   revisionAcademica:null,
   expediente:null,
   history:[]
  };
}

function completarEjemplo(p,key,text){
  if(key==='programaAnalitico'){
    p.sections[key]={
      unidades:[{
        id:1,
        unidadTematica:text.unidadTematica,
        objetivoAprendizaje:text.objetivoAprendizaje,
        temasDesarrollar:text.temasDesarrollar
      }],
      unidadTematica:text.unidadTematica,
      objetivoAprendizaje:text.objetivoAprendizaje,
      temasDesarrollar:text.temasDesarrollar,
      content:text.unidadTematica,
      completed:true
    };
  }else{
    p.sections[key]={...p.sections[key],content:text,completed:true};
  }
}

function seedData(){
  

  return {programs:[],nextId:1};
}

/* ---------- Helpers ---------- */
function getProgram(id){ return db.programs.find(p=>p.id===Number(id)); }
function addHistory(p,actor,accion,detalle,opciones){
  /* `actor` es el nombre del rol con el que se actúa; se registra además el usuario que lo hizo (salvo pasos automáticos). */
  p.history=p.history||[];
  const ids=[...new Set([...Object.keys(roleNames),...directorio.roles.map(r=>r.id)])];
  const rolCodigo=ids.find(k=>nombreRol(k)===actor||roleNames[k]===actor)||null;
  const sinUsuario=!!(opciones&&opciones.sinUsuario);
  const quien=(!sinUsuario&&usuarioActual)?nombreCompleto(usuarioActual):null;
  p.history.push({fecha:new Date().toISOString(),actor:quien?`${quien} (${actor})`:actor,usuarioId:quien?usuarioActual.id:null,rol:rolCodigo,accion,detalle:detalle||'—'});
}
function tieneResolucion(p){ return p.resolucion!=null && String(p.resolucion).trim()!==''; }
function fmtDate(iso){ if(!iso) return ''; const d=new Date(iso); return d.toLocaleString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function pad(n,len){ return String(n).padStart(len,'0'); }
function progreso(p){ const keys=SECTION_DEFS.map(s=>s.key); const done=keys.filter(k=>p.sections[k].completed).length; return Math.round(100*done/keys.length); }
function seccionesCompletas(p){ return EDITABLE_KEYS.every(k=>p.sections[k].completed); }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/* Registra quién pidió la corrección (usuario + rol) para mostrarlo en el programa y en las notificaciones. */
function registrarSolicitudCorreccion(p,rol,obs,grupo){
 const u=usuarioActual;
 p.correccionSolicitada={usuarioId:u?u.id:null,nombre:u?nombreCompleto(u):'',rol,rolNombre:nombreRol(rol),grupo:grupo||null,observacion:obs,fecha:new Date().toISOString()};
}
function solicitanteCorreccion(p){
 const c=p.correccionSolicitada; if(!c) return '';
 return c.nombre?`${c.nombre} (${c.rolNombre})`:c.rolNombre;
}
function observacionAcademica(p){
 if(!p.revisionAcademica) return '';
 const rej=['encuadre','metodos','bibliografia'].map(k=>p.revisionAcademica[k]).find(r=>r&&r.status==='CON_OBSERVACIONES');
 return rej?rej.observacion:'';
}

/* El ingreso solo es posible eligiendo un usuario de la lista: usuario y clave se completan solos (y están bloqueados). */
function elegirUsuarioPrueba(username){
 document.getElementById('loginUser').value=username||'';
 document.getElementById('loginPass').value=username?LOGIN_PASS:'';
 const btn=document.getElementById('btnIngresar'); if(btn) btn.disabled=!username;
}
function poblarUsuariosPrueba(){
 const sel=document.getElementById('loginPrueba'); if(!sel) return;
 const etiqueta=u=>`${nombreCompleto(u)} — ${rolesActivosDe(u).map(r=>nombreRol(r)).join(', ')||'sin roles vigentes'}${u.activo===false?' (inactivo)':''}`;
 const ordenar=(x,y)=>nombreCompleto(x).localeCompare(nombreCompleto(y),'es',{sensitivity:'base'});
 const soloTitular=u=>(u.roles||[]).every(a=>a.rol==='TITULAR_CATEDRA');
 const grupo=(titulo,lista)=>lista.length?`<optgroup label="${titulo}">${lista.map(u=>`<option value="${escapeHtml(u.username||u.email||u.id)}">${escapeHtml(etiqueta(u))}</option>`).join('')}</optgroup>`:'';
 const us=directorio.usuarios.slice().sort(ordenar);
 sel.innerHTML='<option value="">Elegí un usuario de prueba…</option>'+grupo('Autoridades, revisores y usuarios con varios roles',us.filter(u=>!soloTitular(u)))+grupo('Titulares de cátedra',us.filter(soloTitular));
 sel.value=''; elegirUsuarioPrueba('');
}
function enterApp(){
 /* El usuario sale siempre de la lista, no de los campos de texto (que están bloqueados). */
 const sel=document.getElementById('loginPrueba');
 const entrada=((sel&&sel.value)||'').trim().toLowerCase();
 const clave=document.getElementById('loginPass').value;
 if(!entrada){ alert('Elegí un usuario de la lista para ingresar.'); return; }
 return cargarDirectorio().then(()=>{
   const u=directorio.usuarios.find(x=>[x.username,x.email,x.id].some(v=>v && String(v).toLowerCase()===entrada));
   if(!u || clave!==LOGIN_PASS){ alert('Usuario o contraseña incorrectos.'); return; }
   if(u.activo===false){ alert('El usuario está inactivo.'); return; }
   const roles=rolesActivosDe(u);
   if(!roles.length){ alert('El usuario no tiene roles vigentes asignados.'); return; }
   /* En modo API se abre la sesión en el servidor y se traen los programas compartidos. */
   return Persistencia.iniciarSesion(u.username||u.email||u.id,clave)
     .then(()=>Persistencia.esApi()?Persistencia.cargar().then(d=>{ db=d; }):null)
     .then(()=>{
       usuarioActual=u;
       role=PRIORIDAD_ROLES.find(r=>roles.includes(r))||roles[0];
       return cargarMaterias().catch(()=>{}).then(()=>{ migrarDatos(); mostrarApp(); });
     })
     .catch(err=>alert('No se pudo ingresar: '+err.message));
 }).catch(()=>alert('No se pudo cargar el listado de usuarios. Verificá la ruta de usuarios.json o la conexión.'));
}
function mostrarApp(){
 document.getElementById('login').classList.add('hidden');
 document.getElementById('app').classList.remove('hidden');
 const cab=document.getElementById('cabUsuario');
 if(cab) cab.innerHTML=`<b>${escapeHtml(nombreCompleto(usuarioActual))}</b><small>${rolesActivosDe(usuarioActual).map(r=>escapeHtml(nombreRol(r))).join(' · ')}</small>`;
 render('dashboard');
}
function salir(){
 Persistencia.cerrarSesion();
 usuarioActual=null;
 document.getElementById('app').classList.add('hidden');
 document.getElementById('login').classList.remove('hidden');
 const sel=document.getElementById('loginPrueba'); if(sel) sel.value='';
 elegirUsuarioPrueba('');
 actualizarCampanas();
}

function statusBadge(s){
 const cls={BORRADOR:'draft',EN_REVISION:'review',EN_REVISION_ACADEMICA:'academic',APROBADO:'approved',FINALIZADO:'approved'};
 const label={BORRADOR:'BORRADOR',EN_REVISION:`EN REVISIÓN (${nombreRol('DIRECTOR_DEPARTAMENTO')})`,EN_REVISION_ACADEMICA:'EN REVISIÓN ACADÉMICA',APROBADO:'APROBADO',FINALIZADO:'FINALIZADO'};
 return `<span class="badge ${cls[s]||'draft'}">${label[s]||s}</span>`;
}

function render(screen){
 document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));
 marcarVisto(screen);
 const c=document.getElementById('content');
 if(screen==='dashboard') c.innerHTML=dashboard();
 else if(screen==='programs') c.innerHTML=programList();
 else if(screen==='tasks') c.innerHTML=tasks();
 else if(screen==='notifications') c.innerHTML=notifications();
 else c.innerHTML=profile();
 actualizarCampanas();
}

/* ---------- Tareas del usuario (unión de todos sus roles) ---------- */
function taskSummary(){
 const items=usuarioActual?tareasDeUsuario(usuarioActual):[];
 return {items,pendientes:items.filter(it=>it.estado!=='OTRO')};
}
function accionesTarea(it){
 const id=it.p.id, ver=`<button class="btn small" onclick="abrirTarea(${id},'${it.rol}')">Ver</button>`;
 if(it.estado==='DISPONIBLE') return `<button class="btn small primary" onclick="tomarTarea(${id},'${it.codigo}')">Tomar</button> ${ver}`;
 if(it.estado==='OTRO') return `<span class="muted">Tomada por ${escapeHtml(nombreCompleto(it.tomadaPor))}</span> ${ver}`;
 const accion=it.directa?`${it.directa}(${id})`:`abrirTarea(${id},'${it.rol}')`;
 return `<button class="btn small ${it.cls}" onclick="${accion}">${escapeHtml(it.accionLabel)}</button>`+(it.implicita?'':` <button class="btn small" onclick="liberarTarea(${id},'${it.codigo}')">Liberar</button>`);
}
function renderTaskTable(items){
 if(!items.length) return `<p class="muted">No tenés tareas pendientes.</p>`;
 return `<table class="tabla-tareas"><tr><th>Programa</th><th>Carrera</th><th>Tarea</th><th>Descripción</th><th>Rol</th><th>Acción</th></tr>${items.map(it=>`<tr><td>${escapeHtml(it.p.nombre_materia||it.p.name||'')}${it.p.titular?`<br><span class="muted">${escapeHtml(it.p.titular)}</span>`:''}</td><td>${escapeHtml(it.p.career||'')}</td><td>${escapeHtml(it.tarea)}</td><td>${escapeHtml(it.descripcion||it.tarea)}</td><td>${escapeHtml(nombreRol(it.rol))}</td><td>${accionesTarea(it)}</td></tr>`).join('')}</table>`;
}

/* ---------- Pantallas ---------- */
function dashboard(){
 const t=taskSummary();
 const visibles=programasVisibles();
 const aprobados=visibles.filter(p=>p.state==='APROBADO').length;
 const finalizadosConResolucion=visibles.filter(p=>p.state==='FINALIZADO' && tieneResolucion(p)).length;
 return `<div class="toolbar"><div><h1>Bienvenido</h1><p>Aquí encontrás tus tareas pendientes y el estado de tus programas.</p></div>
 ${tieneRol('DIRECCION_ACADEMICA')?'<button class="btn primary" onclick="newProgram()">+ Nuevo programa</button>':''}</div>
 <div class="grid3 grid4">
   <div class="card"><div class="muted">Programas</div><div class="stat">${visibles.length}</div><div class="muted">a tu alcance</div></div>
   <div class="card"><div class="muted">Tareas pendientes</div><div class="stat">${t.pendientes.length}</div><div class="muted">requieren intervención</div></div>
   <div class="card"><div class="muted">Aprobados</div><div class="stat">${aprobados}</div><div class="muted">este ciclo</div></div>
   <div class="card"><div class="muted">Finalizados con resolución</div><div class="stat">${finalizadosConResolucion}</div><div class="muted">programas con número de resolución</div></div>
 </div>
 <div class="card"><h2>Mis tareas</h2>${renderTaskTable(t.items)}</div>
 <div class="card"><h2>Acceso rápido</h2><button class="btn primary" onclick="render('programs')">Ver todos los programas</button> <button class="btn primary" onclick="render('tasks')">Ver mis tareas</button></div>`;
}
function tasks(){ return `<h1>Mis tareas</h1><p>Las tareas se muestran según tus roles y el alcance de cada uno.</p><div class="card">${renderTaskTable(taskSummary().items)}</div>`; }
/* Borra la notificación solo para el usuario actual; si ya no queda ningún destinatario, se elimina. */
function borrarNotificacion(id){
  const n=(db.notificaciones||[]).find(x=>String(x.id)===String(id));
  if(!n || !usuarioActual) return;
  n.usuarios=(n.usuarios||[]).filter(x=>x!==usuarioActual.id);
  if(!n.usuarios.length) db.notificaciones=db.notificaciones.filter(x=>x!==n);
  save();
  render('notifications');
}
function notifications(){
 const t=taskSummary(), u=usuarioActual;
 const guardadas=u?(db.notificaciones||[]).filter(n=>(n.usuarios||[]).includes(u.id)).slice().reverse():[];
 if(!t.pendientes.length && !guardadas.length) return `<h1>Notificaciones</h1><div class="card"><p class="muted">No tenés notificaciones nuevas.</p></div>`;
 return `<h1>Notificaciones</h1><div class="card">${guardadas.map(n=>`<div class="notice success cerrable"><button type="button" class="notice-x" title="Borrar notificación" aria-label="Borrar notificación" onclick="borrarNotificacion(${n.id})">&times;</button><b>${escapeHtml(n.titulo||'Notificación')}</b><br>${escapeHtml(n.texto||'')}<br><span class="muted">${fmtDate(n.fecha)}</span></div>`).join('')}${t.pendientes.map(it=>{const corr=it.codigo==='CORREGIR_PROGRAMA'?solicitanteCorreccion(it.p):'';const obsCorr=corr&&it.p.correccionSolicitada.observacion;return `<div class="notice ${it.p.origenCorreccion?'warn':''}"><b>${it.tarea}</b><br>${escapeHtml(it.p.nombre_materia||it.p.name||'')}${it.p.titular?' — '+escapeHtml(it.p.titular):''} (${escapeHtml(it.p.career||'')}) requiere tu intervención.${corr?`<br>Corrección solicitada por <b>${escapeHtml(corr)}</b>${obsCorr?`: ${escapeHtml(obsCorr)}`:''}`:''}</div>`;}).join('')}</div>`;
}
function perfilUsuarioHtml(){
 const u=usuarioActual; if(!u) return '';
 const nombreDep=id=>((catalogoMaterias.departamentos||[]).find(d=>d.id===id)||{}).nombre||id;
 const filas=(u.roles||[]).filter(asignacionVigente).map(a=>{
   const amb=ambitoDeRol(a.rol); let alcance='Todos los programas';
   if(amb==='DEPARTAMENTO') alcance='Departamento/s: '+(((a.alcance||{}).departamentos)||[]).map(nombreDep).join(', ');
   if(amb==='CATEDRA'){ const cs=(materiasCache||[]).filter(m=>m.titular_id===u.id); alcance='Cátedras: '+(cs.length?cs.map(m=>m.nombre_materia).join(', '):'—'); }
   return `<tr><td>${escapeHtml(nombreRol(a.rol))}</td><td>${escapeHtml(alcance)}</td></tr>`;
 }).join('');
 return `<div class="card"><h2>Mi usuario</h2><p><b>${escapeHtml(nombreCompleto(u))}</b>${u.email?' · '+escapeHtml(u.email):''}</p><table><tr><th>Rol</th><th>Alcance</th></tr>${filas}</table><p class="muted" style="margin-bottom:0">Origen de los datos de usuarios: ${escapeHtml(fuenteDirectorio)}.</p></div>`;
}
function profile(){
 return `<h1>Perfil</h1>${perfilUsuarioHtml()}
 <div class="card"><h2>Datos de la simulación</h2><p>${Persistencia.esApi()?'Los datos de los programas se guardan <b>en el servidor</b> y son compartidos por todos los usuarios de prueba: lo que hace un usuario lo ven los demás al cambiar de solapa.':'Los datos de los programas se guardan en el almacenamiento local del navegador (localStorage), simulando una base de datos real. Podés cerrar la pestaña y volver: los cambios van a seguir ahí.'}</p><button class="btn danger" onclick="reiniciarDatos()">Reiniciar datos de demostración</button></div><!-- Dentro de la solapa Perfil -->
<div class="perfil-seccion" style="margin-top: 20px; padding: 15px; border: 1px solid #ccc; background: #f9f9f9; border-radius: 4px;">
    <h4 style="margin-top: 0;">Sincronización de Dispositivo</h4>
    <p style="font-size: 14px; color: #555;">${Persistencia.esApi()?'Exportá los datos del servidor como respaldo, o importá un archivo exportado (también uno de datos locales) para cargarlo en el servidor.':'Exportá o importá tus programas académicos guardados localmente para usarlos en otra computadora.'}</p>
    
    <!-- Botón para bajar el archivo JSON -->
    <button onclick="exportarDatosUBA()" style="padding: 8px 12px; background-color: #218838; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
        Exportar Datos
    </button>

    <!-- Input oculto y botón para subir el archivo JSON -->
    <input type="file" id="importarFileUBA" onchange="importarDatosUBA(this)" style="display:none" accept=".json">
    <button onclick="document.getElementById('importarFileUBA').click()" style="padding: 8px 12px; background-color: #0056b3; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Importar Datos
    </button>
</div>`;

}
// Función para exportar todo el localStorage a un archivo
function exportarDatosUBA() {
    if (Persistencia.esApi()) {
        /* Descarga el estado del servidor (sirve como respaldo o para importarlo en otro lado). */
        Persistencia.refrescar().then(d => {
            const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "programas_academicos_servidor_" + new Date().toISOString().slice(0, 10) + ".json";
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        }).catch(err => alert("No se pudieron exportar los datos: " + err.message));
        return;
    }
    if (localStorage.length === 0) {
        alert("No hay programas académicos o datos guardados localmente en este dispositivo.");
        return;
    }
    const datos = JSON.stringify(localStorage);
    const blob = new Blob([datos], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "programas_academicos_uba.json";
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Función para importar el archivo y sobreescribir el localStorage
function importarDatosUBA(input) {
    const archivo = input.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = function(evento) {
        try {
            const datosGuardados = JSON.parse(evento.target.result);
            if (Persistencia.esApi()) {
                /* Acepta tanto un export local (localStorage) como uno del servidor. Reemplaza los datos de TODOS. */
                if (!confirm("Esto reemplaza en el SERVIDOR los datos de TODOS los usuarios de prueba por los del archivo. ¿Continuar?")) { input.value = ""; return; }
                Persistencia.importar(datosGuardados)
                    .then(d => { db = d; migrarDatos(); mostrarAlerta("¡Programas importados con éxito en el servidor!", () => render('dashboard')); })
                    .catch(err => alert("No se pudieron importar los datos: " + err.message))
                    .then(() => { input.value = ""; });
                return;
            }
            
            // Reemplaza el contenido local por el importado
            localStorage.clear(); 
            for (const clave in datosGuardados) {
                localStorage.setItem(clave, datosGuardados[clave]);
            }
            
            mostrarAlerta("¡Programas importados con éxito! La página se recargará para actualizar la vista.",()=>location.reload());

        } catch (error) {
            alert("Error: El archivo seleccionado no es válido.");
        }
    };
    lector.readAsText(archivo);
}

function programList(){
 return `<div class="toolbar"><div><h1>Programas académicos</h1><p>Consulta y seguimiento de programas.</p></div>${tieneRol('DIRECCION_ACADEMICA')?'<button class="btn primary" onclick="newProgram()">+ Nuevo programa</button>':''}</div>
 <div class="card"><div class="toolbar"><div class="left"><input id="searchInput" placeholder="Buscar por nombre de programa..." oninput="aplicarFiltros()">
 <select id="estadoFilter" onchange="aplicarFiltros()">
   <option value="">Estado: Todos</option>
   <option value="BORRADOR">Borrador</option>
   <option value="EN_REVISION">En revisión (${nombreRol('DIRECTOR_DEPARTAMENTO')})</option>
   <option value="EN_REVISION_ACADEMICA">En revisión académica</option>
   <option value="APROBADO">Aprobado</option>
   <option value="FINALIZADO">Finalizado</option>
 </select></div></div>
 <div id="programTable">${programRows(programasVisibles())}</div></div>`;
}
function programRows(list){
 if(!list.length) return `<p class="muted">No hay programas que coincidan con la búsqueda.</p>`;
 return `<table class="tabla-programas"><tr><th>Programa</th><th>Carrera</th><th>Año</th><th>Estado</th><th>Avance</th><th>Acciones</th></tr>${list.map(p=>`<tr>
 <td>${escapeHtml(p.nombre_materia||p.name||'')}${p.titular?`<br><span class="muted">${escapeHtml(p.titular)}</span>`:''}</td><td>${escapeHtml(p.career||'')}</td><td>${escapeHtml(p.year||'')}</td><td>${statusBadge(p.state)}</td><td>${progreso(p)}%</td>
 <td class="col-acciones">${['APROBADO','FINALIZADO'].includes(p.state)?`<button class="btn small primary" onclick="imprimirPrograma(${p.id})">Imprimir</button> `:''}<button class="btn small" onclick="openProgram(${p.id})">Ver</button></td></tr>`).join('')}</table>`;
}
function aplicarFiltros(){
 const q=document.getElementById('searchInput').value.toLowerCase();
 const estado=document.getElementById('estadoFilter').value;
 const list=programasVisibles().filter(p=>((p.name||'').toLowerCase().includes(q)||(p.career||'').toLowerCase().includes(q)||(p.titular||'').toLowerCase().includes(q))&&(!estado||p.state===estado));
 document.getElementById('programTable').innerHTML=programRows(list);
}

/* ---------- Alta de programa (Dirección Académica) ----------
   La asignatura se elige de un combo cargado desde el listado de
   materias (materias.json). Al seleccionarla se precargan, de solo
   lectura, los "Contenidos mínimos" y la "Ubicación de la asignatura
   en el currículum" con los datos de esa materia. El Director/a de
   carrera ya no inicia el alta: solo da conformidad más adelante. */
let materiasCache=null;
let materiasPromise=null;
function cargarMaterias(){
 if(materiasCache) return Promise.resolve(materiasCache);
 if(materiasPromise) return materiasPromise;
 materiasPromise=leerJson(Persistencia.urlCatalogo('materias',MATERIAS_JSON_URL),'materias')
   .then(({datos})=>{
     materiasCache=Array.isArray(datos.materias)?datos.materias:[];
     catalogoMaterias={departamentos:Array.isArray(datos.departamentos)?datos.departamentos:[],carreras:Array.isArray(datos.carreras)?datos.carreras:[]};
     materiasPromise=null; return materiasCache;
   })
   .catch(err=>{ materiasPromise=null; console.error('No se pudo cargar materias.json',err); throw err; });
 return materiasPromise;
}
function newProgram(){
 if(!tieneRol('DIRECCION_ACADEMICA')){ alert('Solo '+nombreRol('DIRECCION_ACADEMICA')+' puede solicitar un nuevo programa.'); return; }
 document.getElementById('content').innerHTML=`<div class="toolbar"><div><button class="btn small" onclick="render('programs')">‹ Volver</button><h1 style="margin-top:12px">Solicitar nuevo programa</h1><p>El sistema va a generar el programa en estado BORRADOR. Al elegir la asignatura se precargan, de solo lectura, sus contenidos mínimos y su ubicación en el currículum, para que la cátedra complete el resto.</p></div></div>
 <div class="card">
   <label>Asignatura</label>
   <select id="npName" style="width:100%" disabled onchange="actualizarMateriaSeleccionada()"><option value="">Cargando listado de materias…</option></select>
   <p class="muted" id="npMateriaHelp" style="margin-top:6px;margin-bottom:0">La lista combina nombre de materia y titular. Las combinaciones ya solicitadas no vuelven a aparecer, independientemente del estado del programa.</p>
   <br>
   <label>Carrera</label><input id="npCareer" placeholder="Carrera" style="width:100%" disabled><br><br>
   <div class="grid" style="gap:12px;margin-bottom:18px">
     <div>
       <label>Código de materia</label>
       <input id="npCodigoMateria" style="width:100%" disabled>
     </div>
     <div>
       <label>Departamento</label>
       <input id="npDepartamento" style="width:100%" disabled>
     </div>
   </div>
   <label>Año / Plan</label><input id="npYear" placeholder="2026" value="${new Date().getFullYear()}" style="width:100%">
   <div style="text-align:right;margin-top:14px"><button class="btn" onclick="render('programs')">Cancelar</button> <button id="npSubmitBtn" class="btn primary" disabled onclick="crearNuevoPrograma()">Solicitar nuevo programa</button></div>
 </div>`;
 poblarSelectMaterias();
}
function poblarSelectMaterias(){
 const sel=document.getElementById('npName');
 const help=document.getElementById('npMateriaHelp');
 cargarMaterias().then(materias=>{
   if(!sel || !document.body.contains(sel)) return;
   const materiasDisponibles=materias
     .map((m,i)=>({materia:m,index:i}))
     .filter(({materia})=>{
       const nombre=(materia.nombre_materia||'').trim().toLowerCase();
       const titular=(materia.titular||'').trim().toLowerCase();
       if(materia.catedra_id && db.programs.some(p=>p.catedra_id===materia.catedra_id)) return false;
       return !db.programs.some(p=>{
         const nombrePrograma=(p.nombre_materia??p.name??'').trim().toLowerCase();
         const titularPrograma=(p.titular??'').trim().toLowerCase();
         return nombre && titular && nombrePrograma===nombre && titularPrograma===titular;
       });
     })
     .sort((a,b)=>String(a.materia.nombre_materia||'').localeCompare(String(b.materia.nombre_materia||''),'es',{sensitivity:'base'}));
   if(!materiasDisponibles.length){ sel.innerHTML='<option value="">Todas las combinaciones materia/titular ya fueron solicitadas</option>'; return; }
   sel.innerHTML='<option value="">Seleccioná una asignatura…</option>'
     + materiasDisponibles.map(({materia,index})=>{
       const nombre=materia.nombre_materia||'(Sin nombre)';
       const titular=materia.titular||'(Sin titular)';
       return `<option value="${index}">${escapeHtml(nombre)} - ${escapeHtml(titular)}</option>`;
     }).join('');
   sel.disabled=false;
 }).catch(()=>{
   if(!sel || !document.body.contains(sel)) return;
   sel.innerHTML='<option value="">No se pudo cargar el listado de materias</option>';
   if(help) help.textContent='No se pudo cargar el listado de materias desde el repositorio. Verificá tu conexión e intentá nuevamente.';
 });
}
function actualizarMateriaSeleccionada(){
 const sel=document.getElementById('npName');
 const career=document.getElementById('npCareer');
 const codigo=document.getElementById('npCodigoMateria');
 const departamento=document.getElementById('npDepartamento');
 const btn=document.getElementById('npSubmitBtn');
 const idx=sel?sel.value:'';
 const materia=(idx!=='' && materiasCache)?materiasCache[Number(idx)]:null;
 if(career) career.value=materia ? (materia.carreras||'') : '';
 if(codigo) codigo.value=materia ? (materia.codigo_materia??'') : '';
 if(departamento) departamento.value=materia ? (materia.departamento??'') : '';
 if(btn) btn.disabled=!sel||!sel.value;
}
function crearNuevoPrograma(){
 const sel=document.getElementById('npName');
 if(!tieneRol('DIRECCION_ACADEMICA')){ alert('Solo '+nombreRol('DIRECCION_ACADEMICA')+' puede solicitar un nuevo programa.'); return; }
 const idx=sel?sel.value:'';
 if(idx===''){ alert('Seleccioná una asignatura de la lista.'); return; }
 const materia=(materiasCache||[])[Number(idx)];
 if(!materia){ alert('No se pudo obtener la información de la materia seleccionada. Volvé a intentarlo.'); return; }
 if(!materia.catedra_id || !materia.titular_id || !materia.departamento_id){ alert('El listado de materias no identifica la cátedra, el titular o el departamento de esta asignatura (catedra_id, titular_id, departamento_id). No se puede generar el programa.'); return; }
 const name=(materia.nombre_materia||'').trim();
 if(!name){ alert('La materia seleccionada no tiene nombre cargado.'); return; }
 const career=document.getElementById('npCareer').value.trim()||'Sin especificar';
 const year=document.getElementById('npYear').value.trim()||String(new Date().getFullYear());
 /* El id lo asigna el servidor (modo API) para que dos usuarios no generen el mismo número. */
 Persistencia.reservarIdPrograma(db)
   .then(id=>altaPrograma(id,materia,name,career,year))
   .catch(err=>alert('No se pudo generar el programa: '+err.message));
}
function altaPrograma(id,materia,name,career,year){
 const p=crearProgramaBase(id,name,career,year);
 p.nombre_materia=name;
 p.titular=(materia.titular||'').trim();
 p.codigo_materia=materia.codigo_materia ?? null;
 p.departamento=materia.departamento ?? '';
 p.materiaId=materia.id_materia ?? null;
 aplicarCatedra(p,materia);
 p.sections.contenidosMinimos.content=materia.contenidos_minimos||'Contenidos mínimos de la materia. No pueden modificarse.';
 p.sections.ubicacionCurriculum.content=materia.ubicacion_curriculum||'Ubicación de la asignatura en el currículum. No puede modificarse.';
 db.programs.unshift(p);
 addHistory(p,nombreRol('DIRECCION_ACADEMICA'),'Solicita nuevo programa','Se genera el programa en estado BORRADOR con contenidos mínimos y ubicación curricular precargados desde el listado de materias.');
 save();
 openProgram(p.id);
}

/* ---------- Detalle de programa ---------- */
function section(name,state,done,locked=false){
 return `<div class="section-row"><span>${locked?'🔒':'○'} &nbsp;${name}</span><span>${done?'✓ ':''}${state}</span></div>`;
}

function sectionContentValue(p,s){
 const sec=p.sections[s.key]||{};
 if(s.key==='programaAnalitico'){
   // Una tarjeta por unidad (desde unidades[]); si no hay, usa los campos de nivel superior.
   const unidades=(sec.unidades&&sec.unidades.length)?sec.unidades:
     ((sec.unidadTematica||sec.objetivoAprendizaje||sec.temasDesarrollar)?[sec]:[]);
   if(!unidades.length) return '<p class="muted">Sin contenido cargado.</p>';
   const temasHtml=t=>{
     const temas=(t||'').split(/\r?\n/).map(x=>x.replace(/^\s*[-•]\s*/,'').trim()).filter(Boolean);
     return temas.length
       ? `<ul style="margin:4px 0 0">${temas.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`
       : '<p class="muted" style="margin:4px 0 0">Sin contenido cargado.</p>';
   };
   return unidades.map(u=>`<div style="margin-bottom:16px;padding-left:10px;border-left:3px solid #edf0f3">
       <div style="font-weight:600;margin-bottom:6px">${escapeHtml(u.unidadTematica||'')}</div>
       <div><b>Objetivo del aprendizaje</b><p style="white-space:pre-wrap;margin:4px 0 8px">${escapeHtml(u.objetivoAprendizaje||'')}</p></div>
       <div><b>Temas a desarrollar</b>${temasHtml(u.temasDesarrollar)}</div>
     </div>`).join('');
 }
 return sec.content
   ? `<p style="white-space:pre-wrap;margin:0">${escapeHtml(sec.content)}</p>`
   : '<p class="muted">Sin contenido cargado.</p>';
}
function renderSectionContent(p,s){
 return `<div style="padding:14px 0;border-bottom:1px solid #edf0f3">
   <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
     <h3 style="margin:0">${s.sectionTitle} — ${escapeHtml(s.label)}</h3>
     ${s.locked?'<span class="badge">Solo lectura</span>':''}
   </div>
   <div style="margin-top:10px">${sectionContentValue(p,s)}</div>
 </div>`;
}
// Permisos de edición por rol. Las secciones fuera del ámbito del rol se
// comportan como las secciones protegidas: se pueden visualizar, pero no editar.
function puedeEditarSeccion(key,p){
 const def=SECTION_DEFS.find(s=>s.key===key);
 if(!def || def.locked) return false;
 /* En la revisión académica, quien edita su sección tiene que tener tomada la tarea de chequeo (si todavía está pendiente). */
 const grupo=REVIEW_GROUP_BY_ROLE[role];
 if(p && grupo && p.state==='EN_REVISION_ACADEMICA' && p.revisionAcademica && p.revisionAcademica[grupo].status==='PENDIENTE' && !puedeActuar(p,'CHEQUEAR_'+grupo.toUpperCase())) return false;
 if(role==='TITULAR_CATEDRA') return !p || usuarioAlcanza(usuarioActual,'TITULAR_CATEDRA',p);
 if(role==='DIRECCION_ACADEMICA') return def.reviewGroup==='encuadre';
 if(role==='SUBSECRETARIA_1') return def.sectionTitle==='D. Métodos de conducción del aprendizaje';
 if(role==='SUBSECRETARIA_2') return def.sectionTitle==='C. Bibliografía';
 return false;
}
function primeraSeccionEditablePorRol(p){
 const keys=SECTION_DEFS.filter(s=>puedeEditarSeccion(s.key,p)).map(s=>s.key);
 return keys.find(k=>!p.sections[k].completed)||keys[0]||null;
}

function openProgram(id,rolPreferido){
 const p=getProgram(id);
 if(!p){ render('programs'); return; }
 ajustarRolParaPrograma(p,rolPreferido);
 const nombrePrograma=p.nombre_materia||p.name||'';
 const mostrarImpresion=['APROBADO','FINALIZADO'].includes(p.state);
 let html=`<div class="toolbar"><div><button class="btn small" onclick="render('programs')">‹ Volver</button><h1 style="margin-top:12px">${escapeHtml(nombrePrograma)}</h1><p>Carrera: ${escapeHtml(p.career||'')} · Plan: ${escapeHtml(p.year||'')}${p.titular?`<br>Titular: ${escapeHtml(p.titular)}`:''}${p.departamento?`${p.titular?' · ':'<br>'}Departamento: ${escapeHtml(p.departamento)}`:''}</p>${rolesProgramaHtml(p)}</div><div style="display:flex;gap:10px;align-items:center">${statusBadge(p.state)}${mostrarImpresion?`<button class="btn primary" onclick="imprimirPrograma(${p.id})">🖶&nbsp; Imprimir</button>`:''}</div></div>`;

 if(p.state==='BORRADOR' && p.origenCorreccion){
   const obs=p.origenCorreccion==='DIRECTOR'?(p.conformidadDirector&&p.conformidadDirector.observacion):observacionAcademica(p);
   const origenLabel=p.origenCorreccion==='DIRECTOR'?'del Director/a de Departamento':'de la revisión académica';
   const quien=solicitanteCorreccion(p);
   html+=`<div class="notice warn"><b>Corrección solicitada${quien?` por ${escapeHtml(quien)}`:''}</b><br>Observación ${origenLabel}: ${escapeHtml(obs||'Se solicitaron correcciones sobre el programa.')}</div>`;
 }

 html+=`<div class="card"><div class="toolbar"><div><b>Estado del programa</b></div><div>${progreso(p)}% completo</div></div><div class="progress"><span style="width:${progreso(p)}%"></span></div></div>`;

 if(role==='DIRECCION_ACADEMICA' && ['APROBADO','FINALIZADO'].includes(p.state)){
   const finalizado=p.state==='FINALIZADO';
   const bloqueoRes=finalizado?'':bloqueoTarea(p,'COMPLETAR_RESOLUCION');
   html+=bloqueoRes||`<div class="card"><h2>Resolución del Consejo Directivo</h2>${finalizado?'':`<p class="muted">Completá el número de la resolución que formaliza el programa. Al guardar, el programa pasará a estado FINALIZADO.</p>`}<div class="toolbar" style="justify-content:flex-start;gap:10px;margin-bottom:0"><div>${finalizado?'<label>Número de resolución</label>':''}<input id="numeroResolucion" placeholder="Número de resolución" value="${escapeHtml(p.resolucion||'')}" ${finalizado?'disabled':''} oninput="sincronizarEditarResolucion()"></div><button class="btn red" id="btnEditarResolucion" onclick="habilitarEdicionResolucion()" ${finalizado && tieneResolucion(p)?'':'disabled'}>Editar</button><button class="btn primary" id="btnGuardarResolucion" onclick="guardarResolucion(${p.id})" ${finalizado?'disabled':''}>Guardar</button><button class="btn ${finalizado?'primary':''}" onclick="imprimirPrograma(${p.id})">Imprimir</button></div></div>`;
 }

 const rolesConEdicion=['TITULAR_CATEDRA','DIRECCION_ACADEMICA','SUBSECRETARIA_1','SUBSECRETARIA_2','DIRECTOR_DEPARTAMENTO'];
 const puedeEditarPrograma=rolesConEdicion.includes(role) &&
   (p.state==='BORRADOR' || (['DIRECCION_ACADEMICA','SUBSECRETARIA_1','SUBSECRETARIA_2','DIRECTOR_DEPARTAMENTO'].includes(role) && ['EN_REVISION','EN_REVISION_ACADEMICA'].includes(p.state))) &&
   SECTION_DEFS.some(s=>puedeEditarSeccion(s.key,p));
 const puedeRevisarContenido=rolesConEdicion.includes(role);
 html+=`<div class="card"><div class="toolbar"><h2>Secciones del programa</h2>${puedeEditarPrograma?`<button class="btn primary" onclick="editSection(${p.id})">Editar programa</button>`:''}</div>`
 + SECTION_DEFS.map(s=>section(s.label, s.locked?'Precargado':(p.sections[s.key].completed?'Completado':'Pendiente'), p.sections[s.key].completed, s.locked)).join('')
 + `</div>`;
 html+=`<div class="card"><h2>Contenido del programa</h2><p class="muted">Las secciones se muestran en el orden del programa. "Contenidos mínimos" y "Ubicación de la asignatura en el currículum" son de solo lectura.</p>`
  + SECTION_DEFS.map(s=>renderSectionContent(p,s)).join('')
  + `</div>`;

 html+=accionCard(p);
 html+=`<div class="card"><h2>Acciones</h2><button class="btn primary" onclick="showHistory(${p.id})">Ver historial</button></div>`;

 document.getElementById('content').innerHTML=html;
}

function accionCard(p){ return accionCardBase(p)+tareasTomadasHtml(p); }
function accionCardBase(p){
 if(role==='TITULAR_CATEDRA' && p.state==='BORRADOR'){
   const bloqueoT=bloqueoTarea(p,codigoTareaDelRol(p,'TITULAR_CATEDRA')); if(bloqueoT) return bloqueoT;
   const completo=seccionesCompletas(p);
   return `<div class="card"><h2>Enviar programa</h2><p>${completo?'El programa está completo y listo para enviarse.':'Completá todas las secciones editables para poder solicitar conformidad.'}</p>
   <button class="btn primary" ${completo?'':'disabled'} onclick="solicitarConformidad(${p.id})">${p.origenCorreccion?'Reenviar programa corregido':'Solicitar conformidad'}</button></div>`;
 }
 if(role==='DIRECTOR_DEPARTAMENTO' && p.state==='EN_REVISION'){
   const bloqueoD=bloqueoTarea(p,'DAR_CONFORMIDAD'); if(bloqueoD) return bloqueoD;
   return `<div class="card"><h2>Dar conformidad</h2><p>Revisá el programa completo antes de dar conformidad para avanzar a la revisión académica (Dirección Académica + Subsecretaría).</p>
   <textarea id="obsDirector" placeholder="Comentario (opcional al dar conformidad; obligatorio para solicitar corrección). Queda registrado en el historial."></textarea>
   <div style="text-align:right;margin-top:10px"><button class="btn danger" onclick="directorDarConformidad(${p.id},false)">Solicitar corrección</button> <button class="btn success" onclick="directorDarConformidad(${p.id},true)">Dar conformidad</button></div></div>`;
 }
 if(p.state==='EN_REVISION_ACADEMICA'){
   const grupo=REVIEW_GROUP_BY_ROLE[role];
   if(grupo && p.revisionAcademica[grupo].status==='PENDIENTE'){
     const bloqueoG=bloqueoTarea(p,'CHEQUEAR_'+grupo.toUpperCase()); if(bloqueoG) return bloqueoG;
     return `<div class="card"><h2>Chequear ${GROUP_LABELS[grupo]}</h2><p>Revisá la sección correspondiente y registrá el resultado. Este chequeo es independiente del resto: el programa pasa a APROBADO solo cuando los tres estén sin errores.</p>
     <textarea id="obsAcademica" placeholder="Comentario (opcional si no hay errores; obligatorio para solicitar corrección). Queda registrado en el historial."></textarea>
     <div style="text-align:right;margin-top:10px"><button class="btn danger" onclick="revisarAcademica(${p.id},'${grupo}',false)">Solicitar corrección</button> <button class="btn success" onclick="revisarAcademica(${p.id},'${grupo}',true)">Sin errores</button></div></div>`;
   }
   return `<div class="card"><h2>Revisión académica en curso</h2><table><tr><th>Chequeo</th><th>Responsable</th><th>Estado</th></tr>
   <tr><td>Encuadre</td><td>${escapeHtml(nombreRol('DIRECCION_ACADEMICA'))}</td><td>${estadoChip(p.revisionAcademica.encuadre.status)}</td></tr>
   <tr><td>Métodos de conducción y de evaluación</td><td>${escapeHtml(nombreRol('SUBSECRETARIA_1'))}</td><td>${estadoChip(p.revisionAcademica.metodos.status)}</td></tr>
   <tr><td>Bibliografía</td><td>${escapeHtml(nombreRol('SUBSECRETARIA_2'))}</td><td>${estadoChip(p.revisionAcademica.bibliografia.status)}</td></tr>
   </table></div>`;
 }
 if(p.state==='APROBADO'){
   return `<div class="card"><h2>Expediente</h2><p>Nota de elevación: <b>${p.expediente.notaElevacion}</b><br>Expediente GEDO: <b>${p.expediente.gedo}</b><br>Fecha: ${fmtDate(p.expediente.fecha)}</p></div>`;
 }
 if(role==='DIRECTOR_DEPARTAMENTO' && p.state==='FINALIZADO' && codigoTareaDelRol(p,'DIRECTOR_DEPARTAMENTO')==='NOTIFICARSE'){
   const bloqueoN=bloqueoTarea(p,'NOTIFICARSE'); if(bloqueoN) return bloqueoN;
   return `<div class="card"><h2>Notificación de Resolución</h2><p>El programa tiene número de resolución asignado (<b>${escapeHtml(p.resolucion)}</b>). Notificate para dejar constancia.</p><button class="btn primary" onclick="notificarseResolucion(${p.id})">Notificarse</button></div>`;
 }
 return `<div class="card"><p class="muted">No tenés acciones pendientes sobre este programa con tu rol actual.</p></div>`;
}
function estadoChip(s){
 if(s==='OK') return '<span class="badge approved">OK</span>';
 if(s==='CON_OBSERVACIONES') return '<span class="badge draft">Con observaciones</span>';
 return '<span class="badge pending">Pendiente</span>';
}

/* ---------- Edición de secciones (Titular de cátedra) ---------- */
function editSection(id,key){
  programaAnaliticoActualId=id;
  const p=getProgram(id); if(!p) return;

  if(!key) key=primeraSeccionEditablePorRol(p);
  if(!key) key=SECTION_DEFS[0].key;

  const def=SECTION_DEFS.find(s=>s.key===key);
  if(!def) return;

  const puedeEditar=puedeEditarSeccion(key,p);
  const editableIndex=EDITABLE_KEYS.indexOf(key);
  const idx=editableIndex<0?0:editableIndex;
  const sec=p.sections[key]||{};
  const stepsHtml=SECTION_DEFS.map((s,i)=>{
    const editablePos=EDITABLE_KEYS.indexOf(s.key);
    const esEditableRol=puedeEditarSeccion(s.key,p);
    const isDone=s.locked || (!esEditableRol && !s.locked) || (editablePos>=0 && editablePos<editableIndex) || (s.key===key && sec.completed);
    const isCurrent=s.key===key;
    const soloLectura=s.locked || !esEditableRol;
    const estado=soloLectura?'Solo lectura':(isCurrent?'En edición':(p.sections[s.key].completed?'Completado':'Pendiente'));
    return `<button type="button" class="step ${isDone?'done ':''}${isCurrent?'current ':''}${soloLectura?'locked':''}" title="${escapeHtml(s.label)}${soloLectura?' — solo lectura':''}" onclick="editSection(${id},'${s.key}')"><strong>${escapeHtml(s.label)}</strong><span>${estado}</span></button>`;
  }).join('');
  const locked=def.locked || !puedeEditar;

  let ayuda='El sistema puede sugerir correcciones y observaciones sobre la información ingresada.';
  if(def.sectionTitle==='C. Bibliografía') ayuda+=' Recordá respetar normas APA.';
  if(def.sectionTitle==='D. Métodos de conducción del aprendizaje') ayuda='Completá las características propias de la cátedra para esta parte del programa.';
  if(def.sectionTitle==='E. Métodos de evaluación') ayuda='Los textos sugeridos pueden modificarse para adecuarlos al programa.';

  let editorHtml='';

  if(key==='programaAnalitico'){
    if(!Array.isArray(sec.unidades)){
      sec.unidades=[];
      if(sec.unidadTematica || sec.objetivoAprendizaje || sec.temasDesarrollar){
        sec.unidades.push({id:1,unidadTematica:sec.unidadTematica||'',objetivoAprendizaje:sec.objetivoAprendizaje||'',temasDesarrollar:sec.temasDesarrollar||''});
      }
    }
    editorHtml=`
      <div class="card">
        <div class="toolbar">
          <div>
            <h2 style="margin-bottom:4px">Unidad temática</h2>
            <p class="muted" style="margin:0">Creá una unidad, completá sus tres campos y guardala. Luego podrás seleccionar cualquier unidad de la lista para editarla.</p>
          </div>
          <span class="badge academic">Programa analítico</span>
        </div>

        <label>Unidad temática</label>
        <input id="paUnidad" style="width:100%;margin-top:6px" placeholder="Ej.: Límites y continuidad">

        <label style="display:block;margin-top:14px">Objetivo del aprendizaje</label>
        <textarea id="paObjetivo" style="min-height:110px;margin-top:6px" placeholder="Objetivo que se espera alcanzar en esta unidad"></textarea>

        <label style="display:block;margin-top:14px">Temas a desarrollar</label>
        <p class="muted" style="margin:5px 0">Ingresá un tema por renglón. Cada renglón se mostrará como un bullet.</p>
        <textarea id="paTemas" style="min-height:120px" oninput="actualizarBullets()" placeholder="Tema 1&#10;Tema 2&#10;Tema 3"></textarea>

        <div id="temasPreview" class="bullet-preview">
          <span class="muted">Los temas ingresados aparecerán aquí como bullets.</span>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
          <button class="btn" type="button" onclick="limpiarEditorUnidad()">Limpiar</button>
          <button id="btnGuardarUnidad" class="btn primary" type="button" onclick="guardarUnidadTematica(${id})">Agregar unidad temática</button><input type="hidden" id="unidadEditandoId" value="">
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <h2 style="margin-bottom:0">Unidades temáticas existentes</h2>
          <span class="muted">${sec.unidades.length} unidad${sec.unidades.length===1?'':'es'}</span>
        </div>
        <div id="listaUnidades">${renderListaUnidades(sec.unidades)}</div>
        <label class="check-completa" style="margin-top:16px">
          <input type="checkbox" id="secCompleted" ${sec.completed?'checked':''}> Marcar sección como completa
        </label>
      </div>`;
  }else{
    editorHtml=`
      <div class="card">
        <h2>${escapeHtml(def.label)}</h2>
        <textarea id="secContent" ${locked?'disabled':''} placeholder="${locked?'Sección precargada y no editable.':'Ingrese '+escapeHtml(def.label.toLowerCase())+'...'}">${escapeHtml(sec.content||'')}</textarea>
        ${locked
          ? '<p class="muted" style="margin-bottom:0">Esta sección está precargada y no puede modificarse.</p>'
          : `<label class="check-completa"><input type="checkbox" id="secCompleted" ${sec.completed?'checked':''} onchange="actualizarBotonGuardar(${id},'${key}')"> Marcar sección como completa</label>`}
      </div>`;
  }

  const actionHtml=locked
    ? `<div style="text-align:right;margin-top:12px"><button class="btn primary" onclick="openProgram(${id})">Volver al programa</button></div>`
    : `<div style="text-align:right;margin-top:12px"><button class="btn" onclick="openProgram(${id})">Volver</button> <button class="btn" onclick="saveSection(${id},'${key}',false)">Guardar cambios</button> <button class="btn primary" id="btnGuardarContinuar" onclick="saveSection(${id},'${key}',true)">${editableIndex<EDITABLE_KEYS.length-1?'Guardar y continuar':'Guardar y volver'}</button></div>`;

  document.getElementById('content').innerHTML=`
    <div class="toolbar">
      <div>
        <button class="btn small" onclick="openProgram(${id})">‹ Volver al programa</button>
        <h1 style="margin-top:12px">${escapeHtml(def.sectionTitle)}</h1>
        <p>${escapeHtml(def.label)}${locked?' · Sección precargada':''}</p>
      </div>
    </div>
    <div class="steps">${stepsHtml}</div>
    ${editorHtml}
    <div class="card">${actionHtml}</div>
    <div class="card"><h2>Ayuda</h2><p>${ayuda}</p></div>`;

  if(key==='programaAnalitico') actualizarBullets();
  actualizarBotonGuardar(id,key);
}

function renderListaUnidades(unidades){
  if(!unidades.length) return '<p class="muted" style="margin:0">Todavía no hay unidades temáticas. Completá los tres campos y presioná “Agregar unidad temática”.</p>';
  return `<div style="display:grid;gap:8px">${unidades.map((u,i)=>`
    <label style="display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border:1px solid #dce3ea;border-radius:6px;background:#f8fafc;cursor:pointer">
      <input type="radio" name="unidadTematicaSeleccionada" value="${u.id}" onchange="cargarUnidadTematica(${u.id})" style="margin-top:3px">
      <span><b>Unidad ${i+1}: ${escapeHtml(u.unidadTematica||'Sin título')}</b><br><span class="muted">${escapeHtml(u.objetivoAprendizaje||'Sin objetivo cargado')}</span></span>
    </label>`).join('')}</div>`;
}

function cargarUnidadTematica(id){
  const p=getProgram(programaAnaliticoActualId);
  if(!p) return;
  const sec=p.sections.programaAnalitico;
  const u=(sec.unidades||[]).find(x=>String(x.id)===String(id));
  if(!u) return;
  document.getElementById('paUnidad').value=u.unidadTematica||'';
  document.getElementById('paObjetivo').value=u.objetivoAprendizaje||'';
  document.getElementById('paTemas').value=u.temasDesarrollar||'';
  document.getElementById('unidadEditandoId').value=String(u.id);
  document.querySelectorAll('input[name="unidadTematicaSeleccionada"]').forEach(r=>r.checked=String(r.value)===String(id));
  actualizarBullets();
  const btn=document.getElementById('btnGuardarUnidad');
  if(btn) btn.textContent='Guardar cambios en unidad';
}

function limpiarEditorUnidad(){
  document.getElementById('paUnidad').value='';
  document.getElementById('paObjetivo').value='';
  document.getElementById('paTemas').value='';
  document.getElementById('unidadEditandoId').value='';
  document.querySelectorAll('input[name="unidadTematicaSeleccionada"]').forEach(r=>r.checked=false);
  const btn=document.getElementById('btnGuardarUnidad');
  if(btn) btn.textContent='Agregar unidad temática';
  actualizarBullets();
}

function guardarUnidadTematica(id){
  const p=getProgram(id);
  if(!p) return;
  const sec=p.sections.programaAnalitico;
  if(!Array.isArray(sec.unidades)) sec.unidades=[];

  const unidad=document.getElementById('paUnidad').value.trim();
  const objetivo=document.getElementById('paObjetivo').value.trim();
  const temas=document.getElementById('paTemas').value.trim();
  if(!unidad){ alert('Ingresá el nombre de la unidad temática.'); return; }
  if(!objetivo){ alert('Ingresá el objetivo del aprendizaje de la unidad.'); return; }
  if(!temas){ alert('Ingresá al menos un tema a desarrollar.'); return; }

  const editId=document.getElementById('unidadEditandoId').value;
  if(editId){
    const u=sec.unidades.find(x=>String(x.id)===String(editId));
    if(u){
      u.unidadTematica=unidad;
      u.objetivoAprendizaje=objetivo;
      u.temasDesarrollar=temas;
    }
  }else{
    const nextId=sec.unidades.reduce((max,u)=>Math.max(max,Number(u.id)||0),0)+1;
    sec.unidades.push({id:nextId,unidadTematica:unidad,objetivoAprendizaje:objetivo,temasDesarrollar:temas});
  }

  sincronizarProgramaAnalitico(sec);
  save();

  // La lista queda visible y el editor se limpia para cargar rápidamente otra unidad.
  document.getElementById('listaUnidades').innerHTML=renderListaUnidades(sec.unidades);
  limpiarEditorUnidad();
  document.getElementById('secCompleted').checked=sec.completed;
  actualizarBotonGuardar(id,'programaAnalitico');
}

function sincronizarProgramaAnalitico(sec){
  const first=sec.unidades&&sec.unidades.length?sec.unidades[0]:null;
  sec.unidadTematica=first?first.unidadTematica:'';
  sec.objetivoAprendizaje=first?first.objetivoAprendizaje:'';
  sec.temasDesarrollar=first?first.temasDesarrollar:'';
  sec.content=(sec.unidades||[]).map(u=>u.unidadTematica).filter(Boolean).join('\n');
  sec.completed=(sec.unidades||[]).length>0;
}

function actualizarBullets(){
  const textarea=document.getElementById('paTemas');
  const preview=document.getElementById('temasPreview');
  if(!textarea || !preview) return;
  const temas=textarea.value.split(/\r?\n/).map(t=>t.trim()).filter(Boolean);
  preview.innerHTML=temas.length
    ? `<ul>${temas.map(t=>`<li>${escapeHtml(t)}</li>`).join('')}`
    : '<span class="muted">Los temas ingresados aparecerán aquí como bullets.</span>';
}
/* ¿El titular completó todas las tarjetas editables? Considera el checkbox en pantalla para la sección actual. */
function programaCompletoEnPantalla(p,key){
  if(role!=='TITULAR_CATEDRA') return false;
  const chk=document.getElementById('secCompleted');
  return EDITABLE_KEYS.every(k=>(k===key && key!=='programaAnalitico' && chk)?chk.checked:p.sections[k].completed);
}
/* "Guardar y volver" si es la última sección del flujo o si ya no queda ninguna tarjeta pendiente (en cualquier posición). */
function actualizarBotonGuardar(id,key){
  const p=getProgram(id), b=document.getElementById('btnGuardarContinuar');
  if(!p || !b) return;
  const ultima=EDITABLE_KEYS.indexOf(key)>=EDITABLE_KEYS.length-1;
  b.textContent=(ultima || programaCompletoEnPantalla(p,key))?'Guardar y volver':'Guardar y continuar';
}
function saveSection(id,key,advance){
  const p=getProgram(id); if(!p) return;

  const def=SECTION_DEFS.find(s=>s.key===key);
  if(!def || !puedeEditarSeccion(key,p)) return;

  if(key==='programaAnalitico'){
    const sec=p.sections[key];
    if(!Array.isArray(sec.unidades)) sec.unidades=[];
    const unidadEl=document.getElementById('paUnidad');
    const objetivoEl=document.getElementById('paObjetivo');
    const temasEl=document.getElementById('paTemas');
    const editIdEl=document.getElementById('unidadEditandoId');
    const unidad=unidadEl ? unidadEl.value.trim() : '';
    const objetivo=objetivoEl ? objetivoEl.value.trim() : '';
    const temas=temasEl ? temasEl.value.trim() : '';
    const editId=editIdEl ? editIdEl.value : '';

    // El botón general "Guardar cambios" también guarda la unidad que esté
    // abierta en el editor, sin reemplazar ni borrar las demás unidades.
    if(editId){
      const u=sec.unidades.find(x=>String(x.id)===String(editId));
      if(u){
        if(unidad) u.unidadTematica=unidad;
        if(objetivo) u.objetivoAprendizaje=objetivo;
        if(temas) u.temasDesarrollar=temas;
      }
    }else if(unidad || objetivo || temas){
      if(!unidad || !objetivo || !temas){
        alert('Para guardar una nueva unidad completá los tres campos.');
        return;
      }
      const nextId=sec.unidades.reduce((max,u)=>Math.max(max,Number(u.id)||0),0)+1;
      sec.unidades.push({id:nextId,unidadTematica:unidad,objetivoAprendizaje:objetivo,temasDesarrollar:temas});
    }
    sincronizarProgramaAnalitico(sec);
  }else{
    p.sections[key].content=document.getElementById('secContent').value;
    const completedEl=document.getElementById('secCompleted');
    p.sections[key].completed=completedEl ? completedEl.checked : false;
  }

  save();

  /* Programa completo (todas las tarjetas editables completas): Guardar cambios también vuelve al resumen. */
  const completo=role==='TITULAR_CATEDRA' && seccionesCompletas(p);
  if(!advance && completo){
    alert('Programa completo. Los cambios se guardaron correctamente.');
    openProgram(id);
    return;
  }
  alert('Los cambios se guardaron correctamente.');

  if(!advance){ editSection(id,key); return; }

  const idx=EDITABLE_KEYS.indexOf(key);
  if(idx<EDITABLE_KEYS.length-1 && !completo) editSection(id,EDITABLE_KEYS[idx+1]);
  else openProgram(id);
}

/* ---------- Transiciones de estado ---------- */
function solicitarConformidad(id,confirmado){
 const p=getProgram(id);
 if(!p||p.state!=='BORRADOR') return;
 if(!exigirTarea(p,'TITULAR_CATEDRA')) return;
 if(!seccionesCompletas(p)){ alert('Hay secciones sin completar.'); return; }
 if(!confirmado && !p.origenCorreccion){
   confirmarAccion('Va a solicitar conformidad del Director de Departamento','Solicitar',()=>solicitarConformidad(id,true));
   return;
 }
 if(p.origenCorreccion==='ACADEMICA'){
   p.state='EN_REVISION_ACADEMICA';
   const previo=p.revisionAcademica||{};
   const reiniciados=[];
   const nuevaRevision={};
   ['encuadre','metodos','bibliografia'].forEach(k=>{
     if(previo[k] && previo[k].status==='OK'){
       nuevaRevision[k]=previo[k];
     } else {
       nuevaRevision[k]={status:'PENDIENTE'};
       reiniciados.push(GROUP_LABELS[k]);
     }
   });
   p.revisionAcademica=nuevaRevision;
   addHistory(p,nombreRol('TITULAR_CATEDRA'),'Reenvía programa corregido',reiniciados.length?`Se reinicia el chequeo de: ${reiniciados.join(', ')}. Los chequeos ya aprobados se mantienen.`:'Todos los chequeos ya estaban aprobados.');
 } else {
   const reenvio=p.origenCorreccion==='DIRECTOR';
   p.state='EN_REVISION';
   p.conformidadDirector={status:'PENDIENTE'};
   addHistory(p,nombreRol('TITULAR_CATEDRA'),reenvio?'Reenvía programa corregido':'Solicita conformidad','Queda a la espera de la conformidad del/de la Director/a de Departamento.');
 }
 p.origenCorreccion=null;
 p.correccionSolicitada=null;
 save();
 openProgram(id);
}

function directorDarConformidad(id,aprobado,confirmado){
 const p=getProgram(id);
 if(!p||p.state!=='EN_REVISION') return;
 if(!exigirTarea(p,'DIRECTOR_DEPARTAMENTO','DAR_CONFORMIDAD')) return;
 const obs=document.getElementById('obsDirector')?document.getElementById('obsDirector').value.trim():'';
 if(!aprobado && !obs){ alert('Ingresá una observación para solicitar la corrección.'); return; }
 if(!confirmado){
   if(aprobado) confirmarAccion('Va a dar conformidad con el programa. La acción no puede revertirse','OK',()=>directorDarConformidad(id,true,true));
   else confirmarAccion('Va a solicitar corrección del programa al titular de cátedra.','Solicitar',()=>directorDarConformidad(id,false,true));
   return;
 }
 if(aprobado){
   p.conformidadDirector={status:'OK',observacion:obs,fecha:new Date().toISOString()};
   p.state='EN_REVISION_ACADEMICA';
   p.revisionAcademica={encuadre:{status:'PENDIENTE'},metodos:{status:'PENDIENTE'},bibliografia:{status:'PENDIENTE'}};
   addHistory(p,nombreRol('DIRECTOR_DEPARTAMENTO'),'Da conformidad',`El programa pasa a revisión académica (Dirección Académica y Subsecretaría).${obs?` Comentario: ${obs}`:''}`);
 } else {
   p.conformidadDirector={status:'RECHAZADO',observacion:obs,fecha:new Date().toISOString()};
   p.origenCorreccion='DIRECTOR';
   registrarSolicitudCorreccion(p,'DIRECTOR_DEPARTAMENTO',obs);
   p.state='BORRADOR';
   addHistory(p,nombreRol('DIRECTOR_DEPARTAMENTO'),'Solicita corrección',obs);
 }
 save();
 openProgram(id);
}

function revisarAcademica(id,grupo,ok,confirmado){
 const p=getProgram(id);
 if(!p||!ROL_POR_GRUPO[grupo]||p.state!=='EN_REVISION_ACADEMICA'||p.revisionAcademica[grupo].status!=='PENDIENTE') return;
 const rolGrupo=ROL_POR_GRUPO[grupo];
 if(!exigirTarea(p,rolGrupo,'CHEQUEAR_'+grupo.toUpperCase())) return;
 const obs=document.getElementById('obsAcademica')?document.getElementById('obsAcademica').value.trim():'';
 if(!ok && !obs){ alert('Ingresá una observación para solicitar la corrección.'); return; }
 if(!confirmado){
   if(ok) confirmarAccion('Va a finalizar su revisión. La acción no puede revertirse','OK',()=>revisarAcademica(id,grupo,true,true));
   else confirmarAccion('Va a solicitar corrección del programa al titular de cátedra.','Solicitar',()=>revisarAcademica(id,grupo,false,true));
   return;
 }
 if(ok){
   p.revisionAcademica[grupo]={status:'OK',observacion:obs,fecha:new Date().toISOString()};
   addHistory(p,nombreRol(rolGrupo),`Chequeo de ${GROUP_LABELS[grupo]} sin errores`,obs?`Comentario: ${obs}`:'—');
   const todoOk=['encuadre','metodos','bibliografia'].every(k=>p.revisionAcademica[k].status==='OK');
   if(todoOk) aprobarPrograma(p);
 } else {
   p.revisionAcademica[grupo]={status:'CON_OBSERVACIONES',observacion:obs,fecha:new Date().toISOString()};
   p.origenCorreccion='ACADEMICA';
   registrarSolicitudCorreccion(p,rolGrupo,obs,grupo);
   p.state='BORRADOR';
   addHistory(p,nombreRol(rolGrupo),`Solicita corrección de ${GROUP_LABELS[grupo]}`,obs);
 }
 save();
 openProgram(id);
}

function aprobarPrograma(p){
 p.state='APROBADO';
 const now=new Date();
 p.expediente={
  notaElevacion:`NE-${now.getFullYear()}-${pad(p.id,4)}`,
  gedo:`GEDO-${now.getFullYear()}-${pad(Math.floor(Math.random()*900000+100000),6)}`,
  fecha:now.toISOString()
 };
 addHistory(p,nombreRol('DIRECCION_ACADEMICA'),'Genera nota de elevación','Se eleva el programa con conformidad de Dirección Académica y Subsecretaría.',{sinUsuario:true});
 addHistory(p,'Subs. de Planificación Educativa','Genera expediente GEDO',`Expediente ${p.expediente.gedo} generado. Programa APROBADO.`);
}

function sincronizarEditarResolucion(){
 const i=document.getElementById('numeroResolucion'), b=document.getElementById('btnEditarResolucion');
 if(i && b) b.disabled=!(i.value.trim() && i.disabled);
}
function habilitarEdicionResolucion(){
 const i=document.getElementById('numeroResolucion'), g=document.getElementById('btnGuardarResolucion');
 if(!i || !i.disabled) return;
 i.disabled=false;
 if(g) g.disabled=false;
 sincronizarEditarResolucion();
 i.focus(); i.select();
}
function guardarResolucion(id){
 const p=getProgram(id);
 if(!p || !['APROBADO','FINALIZADO'].includes(p.state)) return;
 if(p.state==='APROBADO'){ if(!exigirTarea(p,'DIRECCION_ACADEMICA','COMPLETAR_RESOLUCION')) return; }
 else if(!usuarioAlcanza(usuarioActual,'DIRECCION_ACADEMICA',p)){ alert('No tenés permisos para corregir la resolución.'); return; }
 const input=document.getElementById('numeroResolucion');
 const numero=input?input.value.trim():'';
 if(!numero){ alert('Ingresá el número de resolución.'); return; }
 if(p.state==='FINALIZADO'){
   /* Corrección del número: el programa sigue FINALIZADO */
   const anterior=p.resolucion||'';
   if(numero!==anterior){
     p.resolucion=numero;
     addHistory(p,nombreRol('DIRECCION_ACADEMICA'),'Corrige Resolución',`Número de resolución corregido: de ${anterior} a ${numero}.`);
     save();
   }
   openProgram(id);
   return;
 }
 p.resolucion=numero;
 p.resolucionFecha=new Date().toISOString();
 p.state='FINALIZADO';
 addHistory(p,nombreRol('DIRECCION_ACADEMICA'),'Completa Resolución',`Resolución del Consejo Directivo: ${numero}. El programa pasa a estado FINALIZADO.`);
 save();
 openProgram(id);
}

/* ---------- Notificación del Director/a de Departamento ---------- */
function notificarseResolucion(id){
 const p=getProgram(id);
 if(!p || p.state!=='FINALIZADO' || !tieneResolucion(p) || p.directorNotificado) return;
 if(!exigirTarea(p,'DIRECTOR_DEPARTAMENTO','NOTIFICARSE')) return;
 const ahora=new Date().toISOString();
 const materia=p.nombre_materia||p.name||'', titular=p.titular||'';
 p.directorNotificado={fecha:ahora,usuarioId:usuarioActual.id};
 addHistory(p,nombreRol('DIRECTOR_DEPARTAMENTO'),'Se notifica del número de Resolución',`El Director/a de Departamento se notificó del número de Resolución ${p.resolucion}.`);
 /* Destinatarios: los usuarios de Dirección Académica y el titular de la cátedra del programa. */
 const destinatarios=usuariosConRol('DIRECCION_ACADEMICA').map(u=>u.id);
 if(p.titular_id && directorio.usuarios.some(u=>u.id===p.titular_id && u.activo!==false)) destinatarios.push(p.titular_id);
 db.notificaciones=db.notificaciones||[];
 db.notificaciones.push({id:Date.now(),fecha:ahora,programaId:p.id,usuarios:[...new Set(destinatarios)],titulo:'Notificación de Resolución',texto:`El Director de Departamento de la asignatura ${materia} del titular ${titular} se ha notificado del número de Resolución`});
 save();
 const activa=document.querySelector('.nav button.active');
 render(activa?activa.dataset.screen:'dashboard');
}

/* ---------- Historial ---------- */
function showHistory(id){
 const p=getProgram(id); if(!p) return;
 const items=(p.history||[]).slice().reverse();
 document.getElementById('content').innerHTML=`<div class="toolbar"><div><button class="btn small" onclick="openProgram(${id})">‹ Volver al programa</button><h1 style="margin-top:12px">Historial — ${p.name}</h1></div></div>
 <div class="card"><div class="timeline">${items.length?items.map(h=>`<div><b>${h.accion}</b> <span class="muted">— ${h.actor}</span><br><span class="muted">${fmtDate(h.fecha)}</span>${h.detalle&&h.detalle!=='—'?`<br>${escapeHtml(h.detalle)}`:''}</div>`).join(''):'<p class="muted">Sin movimientos registrados.</p>'}</div></div>`;
}

/* ---------- Impresión / exportación a PDF ---------- */
/* La primera página se basa directamente en Carátula.docx: se conserva la estructura, bordes y logotipo del Word y se reemplazan únicamente los campos variables. */
/* CARATULA_BG_PNG (imagen de fondo de la carátula, en base64): ver "Recursos embebidos" al final de este archivo. */

function nombreArchivoPrograma(p){
  const base=(p.nombre_materia||p.name||'programa').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ');
  return `${base}.pdf`;
}

function datosProgramaParaImprimir(p){
  const bloques=[];
  let lastSectionTitle=null;
  const titulosTemplate={'A. Encuadre':'1) ENCUADRE GENERAL','B. Programa analítico':'2) PROGRAMA ANALITICO','C. Bibliografía':'3) BIBLIOGRAFIA','D. Métodos de conducción del aprendizaje':'4) METODOS DE CONDUCCIÓN DEL APRENDIZAJE','E. Métodos de evaluación':'5) METODOS DE EVALUACION'};
  SECTION_DEFS.forEach(def=>{
    if(def.sectionTitle!==lastSectionTitle){
      bloques.push({tipo:'seccion',texto:titulosTemplate[def.sectionTitle]||def.sectionTitle.toUpperCase()});
      lastSectionTitle=def.sectionTitle;
    }
    const sec=p.sections[def.key]||{};
    if(def.key==='programaAnalitico'){
      const unidades=sec.unidades||[];
      if(!unidades.length) bloques.push({tipo:'texto',texto:'Sin unidades temáticas cargadas.'});
      unidades.forEach((u,i)=>{
        bloques.push({tipo:'subseccion',texto:`UNIDAD TEMATICA Nro. ${i+1} - ${u.unidadTematica||''}`});
        bloques.push({tipo:'label',texto:'Objetivo de aprendizaje:'});
        bloques.push({tipo:'texto',texto:u.objetivoAprendizaje||'—'});
        bloques.push({tipo:'label',texto:'Temas a desarrollar:'});
        const temas=(u.temasDesarrollar||'').split(/\r?\n/).map(t=>t.trim()).filter(Boolean);
        if(temas.length) temas.forEach(t=>bloques.push({tipo:'bullet',texto:t})); else bloques.push({tipo:'texto',texto:'—'});
      });
    }else{
      bloques.push({tipo:'label',texto:def.label});
      const contenido=sec.content||'—';
      const esBiblio=def.sectionTitle==='C. Bibliografía';
      contenido.split(/\r?\n/).forEach(linea=>{const t=linea.trim(); if(t) bloques.push({tipo:'texto',texto:t,links:esBiblio});});
    }
  });
  return bloques;
}

function imprimirPrograma(id){
  const p=getProgram(id);
  if(!p || !['APROBADO','FINALIZADO'].includes(p.state)){ alert('Solo se puede imprimir un programa en estado APROBADO o FINALIZADO.'); return; }
  if(!window.jspdf || !window.jspdf.jsPDF){ alert('No se pudo cargar el generador de PDF. Verificá tu conexión a internet e intentá nuevamente.'); return; }
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const pageW=doc.internal.pageSize.getWidth(), pageH=doc.internal.pageSize.getHeight();

  /*
     Limpieza de caracteres para las fuentes estándar de jsPDF (Helvetica).
     Los textos pegados desde Word pueden traer guiones especiales, espacios
     raros o viñetas que la fuente no tiene: jsPDF los dibuja mal (desaparecen
     o se muestran con otra tipografía) y calcula mal el ancho de la línea.
     Se reemplazan por equivalentes seguros antes de medir y dibujar.
  */
  function limpiarTextoPDF(texto){
    return String(texto ?? '')
      .normalize('NFC')
      .replace(/\u0091/g,'\u2018').replace(/\u0092/g,'\u2019')
      .replace(/\u0093/g,'\u201C').replace(/\u0094/g,'\u201D')
      .replace(/\u0085/g,'...').replace(/\u2026/g,'...')
      .replace(/[\u201A\u201B\u2032]/g,"'").replace(/[\u201E\u201F\u2033]/g,'"')
      .replace(/[\u0095\u25AA\u25CF\u25E6\u2023\u2043\uF0B7\uF0A7\uF076\uF0D8\uF0FC]/g,'\u2022')
      .replace(/\s*[\u0096\u0097\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]\s*/g,(m)=>/\s/.test(m)?' - ':'-')
      .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g,' ')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2060\uFEFF]/g,'')
      .replace(/[^\t\n\r\u0020-\u007E\u00A0-\u00FF\u2018\u2019\u201C\u201D\u2022]/g,'');
  }

  /* ===== Página 1: Carátula.docx ===== */
  doc.addImage(CARATULA_BG_PNG,'PNG',0,0,pageW,pageH,undefined,'FAST');
  /*
     El texto "Aprobado por Res. Consejo Directivo (FCE)" NO forma parte
     de la información fija de la imagen: se tapa únicamente esa zona de la
     carátula y se vuelve a dibujar como texto PDF para poder completar el
     marcador de la resolución sin convertirlo en una imagen.
  */
  doc.setFillColor(255,255,255);
  doc.rect(95,610,pageW-190,72,'F');
  const nombreMateria=p.nombre_materia||p.name||'', codigo=p.codigo_materia??'', departamento=p.departamento||'', plan=p.year||'', titular=p.titular||'', carrera=p.career||'', resolucion=p.resolucion||'';
  function textFit(texto,x,y,maxWidth,size,style='normal',align='left'){
    let s=size;
    while(s>8){ doc.setFont('helvetica',style); doc.setFontSize(s); if(doc.getTextWidth(limpiarTextoPDF(texto))<=maxWidth) break; s-=0.5; }
    doc.text(limpiarTextoPDF(texto),x,y,{align});
  }
  function underlineText(texto,x,y,size,style='normal'){
    doc.setFont('helvetica',style); doc.setFontSize(size); doc.text(limpiarTextoPDF(texto),x,y);
    const w=doc.getTextWidth(limpiarTextoPDF(texto)); doc.setLineWidth(0.7); doc.line(x,y+1.5,x+w,y+1.5); return w;
  }
  textFit(`Departamento de ${departamento}`,297.64,316.86,310,20,'normal','center');
  let w=underlineText('Asignatura:',120.55,369.44,16,'normal'); textFit(nombreMateria,120.55+w+5,369.44,350-w,14,'bold','left');
  w=underlineText('Código:',120.55,408.54,16,'normal'); textFit(String(codigo),120.55+w+5,408.54,350-w,16,'bold','left');
  textFit(`Plan Vigente (${plan})`,305.15,452.52,300,18,'bolditalic','center');
  w=underlineText('Cátedra:',120.60,513.64,16,'normal'); textFit(`Prof. ${titular}`,120.60+w+5,513.64,435-(120.60+w),16,'normal','left');
  w=underlineText('Carrera:',120.60,552.74,16,'normal');
  doc.setFont('helvetica','normal'); doc.setFontSize(16); if(typeof doc.setCharSpace==='function') doc.setCharSpace(0);
  const carreraLineas=doc.splitTextToSize(limpiarTextoPDF(carrera),450-(120.60+w));
  doc.text(carreraLineas,120.60+w+5,552.74,{align:'left',lineHeightFactor:1.15});
  /* Posiciones fijas, con margen amplio para que "Aprobado..." / "Nro."
     no se superpongan con "Carrera" aunque ésta ocupe varias líneas
     (hasta ~8-9 líneas de carrera quedan cubiertas con este margen). */
  const aprobadoY=720, nroY=748;
  doc.setFont('helvetica','bold');
  doc.setFontSize(18);
  doc.text('Aprobado por Res. Consejo Directivo (FCE)',297.64,aprobadoY,{align:'center'});
  const nro=`Nro.: ${limpiarTextoPDF(resolucion) || '________________'}`;
  doc.text(nro,297.64,nroY,{align:'center'});

  /* Texto de contradicción: posición fija, con margen amplio antes del
     borde inferior de la caja de la carátula (esa línea está ~811pt). */
  const contradiccion='En caso de contradicción entre las normas previstas en la publicación y las dictadas con carácter general por la Universidad o por la Facultad, prevalecerán éstas últimas.';
  doc.setFont('helvetica','normal');
  doc.setFontSize(8.5);
  const contradiccionX=92, contradiccionW=411, contradiccionLineas=doc.splitTextToSize(contradiccion,contradiccionW);
  let contradiccionY=776;
  contradiccionLineas.forEach(linea=>{
    doc.text(linea,contradiccionX,contradiccionY);
    contradiccionY+=11;
  });

  /* ===== Página 2 en adelante: resto del programa ===== */
  doc.addPage();
  const marginX=54,maxWidth=487,pageBottom=785; let y=48;
  function nuevaPagina(){doc.addPage();y=48;}
  function asegurar(h){if(y+h>pageBottom)nuevaPagina();}
  function normalizarTextoPDF(texto){
    let t=limpiarTextoPDF(texto)
      .replace(/[ \t\r\n]+/g,' ')
      .normalize('NFC')
      .replace(/[\u0300-\u036f\u200B-\u200F\u2060\uFEFF\u00AD]/g,'')
      .trim();

    /*
       Algunos textos que quedaron almacenados en versiones anteriores del
       mockup pueden contener espaciado carácter por carácter ("E l e x a m e n").
       Si detectamos ese patrón, usamos la redacción original de esos dos
       campos estándar en lugar de imprimir el texto deformado.
    */
    const textoEvaluacion='El examen final integrador comprenderá temas teóricos y prácticos de la asignatura, debiendo el alumno aprobar ambos temarios, para que su calificación resulte promediada, con un puntaje que alcance por lo menos un 60% de los contenidos. Por consiguiente, los alumnos que obtengan una calificación inferior a 4 (cuatro) puntos serán considerados insuficientes y aquellos con una calificación igual o superior a 4 (cuatro) aprobarán la asignatura con dicha nota (Resolución CD 406/2006).';
    const textoPromedio='En los casos en que fuere necesario expresar en número entero el promedio de notas parciales o de estas y el examen parcial, se aplicará el número entero superior si la fracción fuere de 0.50 puntos o más y el número entero inferior si fuere de 0.49 o menos. Cuando la nota fuese de 3.01 a 3.99 se calificará con 3 (tres) puntos. (Resolución CS 4994/93)';
    const palabras=t.split(' ');
    const tokensCortos=palabras.filter(w=>w.length===1 && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(w)).length;
    if(palabras.length>12 && tokensCortos/palabras.length>0.45){
      if(t.includes('El examen final') || t.startsWith('E l e x a m e n')) t=textoEvaluacion;
      else if(t.includes('número entero') || t.startsWith('E n l o s c a s o s')) t=textoPromedio;
    }
    return t;
  }
  function ajustarLineas(lineas,ancho){
    const res=[];
    lineas.forEach(l=>{
      if(doc.getTextWidth(l)<=ancho){ res.push(l); return; }
      let actual='';
      for(const ch of l){
        if(actual && doc.getTextWidth(actual+ch)>ancho){ res.push(actual); actual=ch; }
        else actual+=ch;
      }
      if(actual) res.push(actual);
    });
    return res;
  }
  /* ---- URLs clicables en bibliografía ---- */
  function detectarUrls(texto){
    const rangos=[], re=/\b(?:https?:\/\/|www\.)[^\s<>"]+/gi; let m;
    while((m=re.exec(texto))){
      let u=m[0];
      /* se descarta puntuación final que no forma parte de la dirección */
      while(u.length && (/[.,;:!?'"\u2019\u201D\]}]$/.test(u) || (u.endsWith(')') && (u.match(/\)/g)||[]).length>(u.match(/\(/g)||[]).length))) u=u.slice(0,-1);
      if(u.length<=4) continue;
      rangos.push({ini:m.index,fin:m.index+u.length,url:/^www\./i.test(u)?'https://'+u:u});
    }
    return rangos;
  }
  /* Parte un renglón en tramos (texto común / URL) según los rangos de URL. */
  function tramosDeLinea(linea,ini,rangos){
    const fin=ini+linea.length, res=[]; let pos=ini;
    rangos.forEach(r=>{
      const a=Math.max(r.ini,ini), b=Math.min(r.fin,fin);
      if(a>=b) return;
      if(a>pos) res.push({t:linea.slice(pos-ini,a-ini),url:null});
      res.push({t:linea.slice(a-ini,b-ini),url:r.url});
      pos=b;
    });
    if(pos<fin) res.push({t:linea.slice(pos-ini),url:null});
    return res.length?res:[{t:linea,url:null}];
  }
  function addText(texto,{size=10,style='normal',align='left',gapBefore=0,gapAfter=7,indent=0,links=false}={}){
    const limpio=normalizarTextoPDF(texto);
    if(!limpio)return;
    if(typeof doc.setCharSpace==='function') doc.setCharSpace(0);
    y+=gapBefore;
    const ancho=Math.max(40,maxWidth-indent);
    const lineHeight=size*1.35;
    /*
       La fuente y el tamaño del bloque se fijan ANTES de cortar en renglones:
       si no, splitTextToSize mide con la tipografía del bloque anterior
       (p. ej. un título en negrita) y los renglones quedan más cortos o se
       pasan del margen derecho.
    */
    doc.setFont('helvetica',style);
    doc.setFontSize(size);
    if(typeof doc.setCharSpace==='function') doc.setCharSpace(0);
    const lineas=ajustarLineas(doc.splitTextToSize(limpio,ancho),ancho);
    const rangosUrl=links?detectarUrls(limpio):[]; let cursor=0;
    lineas.forEach(linea=>{
      let iniLinea=limpio.indexOf(linea,cursor); if(iniLinea<0) iniLinea=cursor; cursor=iniLinea+linea.length;
      asegurar(lineHeight+3);
      /*
         Fijar explícitamente fuente y espaciado en cada renglón evita que
         un estado tipográfico previo del PDF deforme los caracteres.
      */
      doc.setFont('helvetica',style);
      doc.setFontSize(size);
      if(typeof doc.setCharSpace==='function') doc.setCharSpace(0);
      const x=align==='center'?297.64:marginX+indent;
      if(!rangosUrl.length){
        doc.text(linea,x,y,{align:'left'});
      }else{
        let xi=x;
        tramosDeLinea(linea,iniLinea,rangosUrl).forEach(tr=>{
          doc.setFont('helvetica',style); doc.setFontSize(size);
          if(tr.url) doc.setTextColor(5,99,193); else doc.setTextColor(0,0,0);
          doc.text(tr.t,xi,y,{align:'left'});
          const wt=doc.getTextWidth(tr.t);
          if(tr.url){
            doc.setDrawColor(5,99,193); doc.setLineWidth(0.5); doc.line(xi,y+1.5,xi+wt,y+1.5);
            doc.link(xi,y-size*0.85,wt,size*1.15,{url:tr.url});
          }
          xi+=wt;
        });
        doc.setTextColor(0,0,0); doc.setDrawColor(0,0,0);
      }
      y+=lineHeight;
    });
    y+=gapAfter;
  }
  datosProgramaParaImprimir(p).forEach(b=>{
    if(b.tipo==='nota') addText(b.texto,{size:9,style:'italic',gapBefore:12,gapAfter:14});
    else if(b.tipo==='seccion') addText(b.texto,{size:13,style:'bold',gapBefore:9,gapAfter:9});
    else if(b.tipo==='subseccion') addText(b.texto,{size:11,style:'bold',gapBefore:6,gapAfter:5});
    else if(b.tipo==='label') addText(b.texto,{size:10,style:'bold',gapAfter:4});
    else if(b.tipo==='bullet') addText(`• ${b.texto}`,{size:10,indent:10,gapAfter:3});
    else addText(b.texto,{size:10,style:'normal',gapAfter:6,links:!!b.links});
  });
  const pdfBlob=doc.output('blob'), pdfUrl=URL.createObjectURL(pdfBlob), nuevaVentana=window.open(pdfUrl,'_blank');
  if(!nuevaVentana){const enlace=document.createElement('a'); enlace.href=pdfUrl; enlace.download=nombreArchivoPrograma(p); enlace.click();}
  setTimeout(()=>URL.revokeObjectURL(pdfUrl),60000);
}

/* En modo API, cada cambio de solapa trae del servidor lo que hayan hecho los demás usuarios. */
document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>{
  Persistencia.refrescar().then(d=>{ if(d){ db=d; migrarDatos(); } })
    .catch(err=>console.warn('No se pudo refrescar desde el servidor',err))
    .then(()=>render(b.dataset.screen));
}));
/* Usuarios de prueba disponibles en la pantalla de ingreso (primero se detecta si hay API). */
Persistencia.detectar().then(()=>{ if(Persistencia.esApi()) db=seedData(); }).then(cargarDirectorio).then(poblarUsuariosPrueba).catch(()=>{ const sel=document.getElementById('loginPrueba'); if(sel) sel.innerHTML='<option value="">No se pudo cargar usuarios.json</option>'; });
/* Cualquier cambio de pantalla (programas, secciones, etc.) refresca las campanas: sin tareas pendientes no hay campana. */
if(typeof MutationObserver!=='undefined'){
  const contenido=document.getElementById('content');
  if(contenido) new MutationObserver(()=>actualizarCampanas()).observe(contenido,{childList:true});
}

/* =========================================================
   Recursos embebidos
   Imagen de fondo de la carátula del PDF, en base64. Se deja en
   este archivo (y no como .png aparte) porque jsPDF la necesita
   como data URL y los navegadores bloquean la lectura de archivos
   locales (file://) desde el código.
   ========================================================= */
const CARATULA_BG_PNG='data:image/png;base64,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7dt227ZmTcu2nSw9WhNK2a2xQghJsATBEgAAnIrstiPTNC+44ILMzMzOnTvbrVLXXHNNjx49SkpKbr755tLS0nnz5rlcLjvULVy4cPz48ZdccsmBAwdWrVr1ySefJCYmjh49+rHHHrv66qvtjPHUU089/fTTfr//ySeffO2114QQUsrff/99xowZlmXNmzdvyJAhUsrhw4cPHjzYNM3hw4dfeeWVTzzxhGEYmqY9+OCD69evHzRoUHZ29q5dux599NGhQ4faOc1pN7viiitatWrVqFGjTZs2RUREPPbYY927dy8qKjrrrLMGDhxohyghxJ133mnnUqfH6aeffvrxxx/37dt379692dnZTz/9dKdOnR5//PFRo0b169evb9++Q4cObdy4sd3aes89d2/btv2GG26488477777Lk3Tfv99/QUXXLBs2dKMjPQNGzaMGTNm2LBhuq7PmjXrtdde69at27fffrt69er//d//tTfg1VdfnTZt2vTp09u1a2dHwY8//njq1KlDhw5dt26dUuqdd95xu/8Y1UVKuW/fvuuuu+7MM890WncfeeSRBg0aTJo0ad68ef369du+fXthYeEzzzzTokWL4uLi22+/XdO0jh07zps374YbbrjiiiuEEPfee++iRYsWLVrUvHlzIcRrr722evXq6dOnW5b18ccfv/zyyxdddNFLL70UFxdnH50vv/zyrrvuuvPOOydOnGhn9UAgcOGFF+7evXvLli0NGjR44okn3nzzTSHEokWLnn32WTsnL1269JFHHjnnnHPs3P7OO++8++67M2bMaNu2ra7rXq/33//+9/vvvz906ND169ebpjllypTIyMjgRtSwIpVVJiIaNMzcu2dPevPuRRntSg5v1QzhVQHTEMJXsnfD6qhD22MLduiyTA8ot9KNhsladIxl+QLCsoTfEC5PeUGcd3+hP811KC85sbWR3jQn+3fdXyb1GKVFa9Jt+FVMoDzGV7h984ZG6R0bRBg7Nq3OTEzTAjHCLzzllt+MkyJG06IC8e09mR19vy/yxDdIiYmLcZXmN0izstLKcg7nZc1u3aqD2aHf7sP74swDkeXGYZfb1aGnV+lGUXl8UrNyw4hUlhRSSSGEUJLnWIJgCQAATlFOo+WoUaPGjRtndxy1u2uWlJQ0btw4EAgUFRWlpqaappmdnX3fffc98cQTw4YN8/v9Dz744IQJE9566y27PdBOnk5HTTsKij+7RA4YMKBfv35KqRtvvPHpp5/WNM1+1zfffJOWlrZixYri4uLExER7Cd26dXv22WfLysrWr18/bty4jIyM7t27O2HYsqyIiIhrr732vPPOKy4unjVr1q233jpv3jx7dTfccMN5551nv7aTqhDC7sxZWFj40UcfPfDAA2eddVZJScn//M//LF68uH379k4XTSnl2LFjBw4caBiGUsLlcu3YsUMI8d1331155RUZGRl2k5umaWVlZQ899NCNN974t7/9TSnVsGHDcePGLViwwF6dvfbi4uJdu3YNHjx49uzZrVu31jRt8eLFTz/99IwZM1q3bl1cXDx27Nhffvll0KBBTn9XIUS3bt0mTpwYFRVlHx2Px5OTkzN79uwnnnjijDPOKCoqevDBB5cuXdq8efNFixaZpjlp0qS4uLiRI0eOHTu2c+fOnTt3tjskz5gx44477nD6nSqlfvvtt+eee+6TTz5p27Ztfn7+7bff/tJLL9177732sZg1a9Ytt9zSpEkTKWVWVpbP57MLzTmOXq93ypQpF1xwwbXXXmtZ1rRp07755puBAwe63e6CgoJly5ade+65s2fPbteund0u+uyzz06fPr1Dhw75+fk33njjTz/9NHToUO1I3UE1pUdZARHfRMXsLMnPTurcc2/22sTizYYRpaQSWllAKq9fxrukf99amdGyMLad3q5NZFleYNt6b17xgbRWZmSm6Q/4fYelyxdVXlKwKdCw+ZkiMmCoXF9ZiTexuTs+xR3TUFNeIS1N0/UoV4In0r0rT4gUr0yIkC4pIgMytmFm67x9PX3x0bJV++LsfQnS2jT/u1QtkNjl9EBqfPPevTYtXn549+6oppnC6/VIWeb2FCakZrTomHMoN7JJC2XEuIQphd8vI5QQmrKkIleCwXsAAMCpGyxthmEYhhEREeF2uw3DME3zk08+iY6ONgzj3//+t93aVl5enpGR0atXLyGE2+2+6KKLCgsLnfsA7Xhmp6MK+UFKaRiGx+PxeDyapkVERHg8Hrvf5qJFix544IEWLVpkZ2fbQ+nYC3G73fHx8Wecccall166fv16J6M6NxPaW9uwYcNzzz23SZMmdv9MO0y6XC6Xy+V2u52sa3c9/fTTTy3LGjRokK7rcXFxAwYMWLhwod2l1t5++xbHyMhIt9veVF1KLTMzMzMzc/v2HcH3eUopS0tLzz33XMMwdF0///zz7U6twUW6ffv2goKCiy++2N41pVRpaWlKSkpaWpqu6zExMTfccIPTXOmMOWTvu8fjsfdCCPH2229rmta7d28hRIMGDYYOHbpmzRql1LvvvturV6+EhAS70fLKK6/85ZdflFKWpa644sr58xeUlpZLqWmarpSQUsvJOTB48NnNmjVXSiUkJNxzzz07duywyzwpKally5Z2t17Lsj7//PMWLVqIoJs8hRArVqxYvnz5lVde6XK5PB7PwIED169ff/DgQSFEdna23+8fPXr07t27fT6fEKKkpKRly5YZGRlKqfj4+LFjx8bHx1cY9iksy9Kl5fMb8Zld++7cuFxvmKK17hkQym36PD6vCATaDjyvxUVjZYO2auv6sqwNLYdcnNSyR8HBbF/JwYIFczP7D+/Yc2BhdlFAxmoBFRmQ3j0HfHt3GKU50WX7spZ817Jrh+QOHYtydktRGtAszV94YNOSoq1LPeU5Lu8+SxbqvsMBWaqsA2bWpmY9uiU3Tdn5yywjLcWtDidn/24U5SamuGNEbtnePU0HDo8a2C//4LoGojQQcB9yx2qn9YyMaXAwa19k89Y+I9IwvUr5fUKaQgkVEBa5ErRYAgCAUzFSij+bE+006EQm+79r167929/+5na733jjDZ/P53K5fv/999atWzds2NBuluzVq9fkyZPt5TjtWtUnpTx48ODWrVvvvffeVatWvfnmmy+++GLwUDF2yoqPj586deqYMWMqvNf+byAQSE5ObtCgwa+//jp06FBnxKAKow3Z8+/YsSM1NdUJh2eeeeZpp53mdrud5kpnvB/DsEcP0i3Lio2NOeecIa+88kqfPr3tQVZN0ywrK2vSpEnTpk3tNt4WLVpMnTrV7XY7Q9oIIXbu3Nm7d+9GjRr99NNP+/bta968eWxsbE5Oztq1a3v16mUYxtChQ519sTfAGUrHXqydxPLz89u0aWNnZiHEOeec06tXL13XIyMjhw8fLv4cxEjX9a+//vrWW2+VUjZp0jQQMD/77LPrr7/O7j6slNq0aXPPnr3cbrcdfhs1apSVlWX/NBAXF3f66adv27atS5cuQogDBw5ceeWVS5cudR6Uomna/v37neQvhEhOTn7vvffsm1S3bt3avXv3zMzMOXPm/P3vf7fv0d28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pKenN2vWbO7cuaWlpfZm+P1+0zSzsrKmTZtm3+9nL81JjPZrn8+3dOnSjRs3NmrUyG5ddMJhIBCwY6oToS+99FK/379s2TLTNH0+38cff3zeeed5PB67KJw+n/bwPPbuKKXs7otKqWuuucZ+r70LERERCxcutGdesGDB/v37nYyXm5v7zTff9OrVKy0trVGjRunp6R07dty2bZvX6/3kk08KCgrs1a1YsSK4YTaYXcL2jZRXXHFFaWnp2rVrhRClpaX//ve/zzzzTLfbPXr06EWLFvl8PqXU/v37v/vuuyFDhvx5HJVlWS6X6/zzz7ebGYUQCQkJ//73v/Py8kzT9Pv977zzjlNodgk0b95869atpml27Nixwu8OSqkePXp06dJl+vTp9qH54osvzjjjjNjY2OnTpw8cOLDRnxo3bvz7779HRUW9//77ubm5lmX5fL7vv//eLucjPm5Eqj9/87D/q+m6O7JDl9Oz9+WUS0+zQaMLE1u4/UqWm8pw6ao8wvRqwtRkiSYCfitRaeWWVmbqPlP3mbrf1AMB3QzowqcLvy5MKZXQhNCU0JTQLKFb0rCEoYSuhBRCCmH5dX+Z4fcaMqAidNMdEfC5rRJNCb+VKEW88gW8Wky55jLUYZfmK0vtkNj/yn37DxXu2pTSqovQPUJoSihhZ0jp/Af4A11hAQDAqSY4MzhNSXZge+aZZyIiIuxOkpqmJSQkKKVeeeWViRMnPvTQQ/fee++tt966e/fun3766b333tM07aGHHrr77rv9fn9KSsrzzz9/8803ezwer9e7devW1157zbmT84orrrCfyWEHs82bN5911lnO4Dd9+/Y988wzt2zZIoTYtGnTK6+8smjRotzc3Kuuuqpr167BY9hallVaWjpjxozVq1f/9NNPHo/niSeeiIuLy8/P1zRt5syZu3btspd5wQUXZGZmOtkyLS3tqquuevjhh2+44Yb//Oc/Xq931KhRwTeL6ro+ffr0jRs32ndLnnfeeU77p6ZpTZs27dOnz7Rp0zRN83g8d9xxxz/+8Y/8/HyXyzVlypRnnnnG4/HYcbegoMDumGrfJmoYxrXXXvv666+fffbZKSkpN91007XXXrtgwYK1a9e+//77TsdUe0vWrVv3xhtvuFwue9XXXHNNixYthg0bdt99991www3Tp09PSEgYMWKEUmro0KFffvnlhAkTBgwY8Prrrw8bNuy0005zHqRpGzRokD2qkFKqT58+V1999dixY6+++upff/11//79Tz/9tNOXWEqZnp5eWFjYqFGj4J8bxJ9BLyoqavz48Y8++mhOTk5ubu6yZcuefPLJsrKy8vJye6Bge7abb775ww8/PO+885o1azZ27Nibb775559/3rJlyzvvvGN3961mtlRSCCEtJaXm0iOim3foumnNsmZtWzQZPu7ArA88WasjvKVew+OVli6KhZJKRWiWR+j5SppCaEoKS+hCSKE0IaQlNHuJVpU5z69bmrIMy5LKUFL3a0pXpiaEUi6fjNUtn0tTQmi64S9SLn9mt2Z9R+7PLc7aub97r/PdsSkWw/PgSPTHH3+cUqh1W7Zs+eijj5x/jh071h7ZDAAAHAdOkrET1xlnnJGSkmIHS4/H06NHD/tORXtKZmZmu3btGjVq1Llz58aNG+fl5cXGxt5+++2tWrUSQjRu3Lhbt25FRUWmaQ4bNuyiiy6yH8/odrvtB2NGRETExMS0bds2JiamYcOGTZs2tXPXueee63a77c0wDKNBgwa6rnfq1Kl169aRkZHt2rUbM2bMhRdeaPdldfrQ6rqenJycmpoaExPTu3fvu+++u3v37kIIXdebNGnSuHFjj8cTGRnp8Xhat24dExPjZCRd1zt37tysWbOCgoJmzZrdeuutjRs31nU9ISGhXbt2DRo0aNq0aXp6uv2YTZfL1bp164SEhNatW7do0cIOTn369OnQocNpp53mcrmaNm3apUuX3NxcXdfHjBnTu3dvTdOio6NbtmyZmZnZvXv3Tp06ORkvMjLSMIxevXoNGTLEfgZmRkbG+PHj09PT7fBpj3BrGEZMTIy98fZbOnXq5PF4TjvttKZNm+bn57dt2/Zvf/tbSkqKEMJ+mKRSqrCwsH///ldffbUdR5OTkzt37pyWlialTExMPP3007t3796iRQt7A2JjY4uKiho3bnzHHXc0bNhQ07SoqKhOnTq1a9fOLrFRo0ZFR0d7PJ42bdp0797d5XI1bNiwcePGhmE0atSoW7du+fn5SUlJN910k51je/Xq1aFDB6exNyoqyrKs3r179+/fPzIysrCwsHHjxn//+9/T0tLsuH6kVGmPoKrsYKmUfVuodLvdMbFxOzZtjo1vGNey7cHs/a6Sw5oq9xtmQLqEFeMytUiryNSEELoQmhCaJqRUUhOarqRhaYYS8o+8WilDWW5TM0xDShXQLUsqS7iFijSlZhplSle6pRmivEBG+DsMSR9wyaGCggPbtnXqOyIiuZ0SLqlrJ2lVwCX68SttRZfoOjBz5swRI0Y4/1ywYEH//v0pFgA4GfFFeZIeteDGOqdpTgQNimOnSrtR0Q5IwS149kNHxJ+j4zjzO9epdlNh8BCywct3llmhy2WFkyoQCNjPh3Ru+auwluDbKe1+sM4GO0PFOG8JvqPSacm0l+P0RxVBY6s622ZPd95iz+wMC+TMY5eMc6elPTZScIa3ZxB/Nts6f7XbDO23OJ1ynXFrnbUHHwVngyvsV/ABtQ+f3+93DlDw7jj/dFpN7T669mbba7ffGHwvrjN/8MM2nY2swNlZZ8ervs3yz66wliWl/VBLoZRQAU34hQgECg/uXr+8QYMGnghX9tKZkbsXRvoK/SJaF1Z0oNhQZrEepaQUwpJCSWFJJXS726uSmiUDuvDpVVVW0X7ll7pX14Q0DeWXQvpFREDTNeH1iMPKcvlkXKknPtB2QNN+w/dn7dy/K6td3+GR8Y2VHimU0AztZKwMKxwRLtHrFF1hAQDAqaZCogtOmMFPs3BeO1HHyUhOprJfBN8uWOFdwSt1Io391wqXthUymBDCbvx0WrqCM1XocxGd2ewZnEzrbHlwi1lw4g0tlgo9Nu3Zgt9ud52tsF9OoTnrCt7y4HU5DwsJ3gt75uAyDP6v84wTJ8U5W+v8KbgMnel2S6b9ruD/Olk0eMn2hgUfUxFyb6T9z+DddyZWyNjODEfsARv604cdMzVNE8olpCaF4UpIbdal95bfFghV1Grw0NydbbN/mZNUstMjivyGDJgRljSUtAvBUkppdkkooSkhNCGFqnoEnRLDUpoQQuimplkuoZlSL9Z1yzA1lz/Kr/Sy5MyYnhd6Mprv3LguMjrxtLMuF1Fplq5LYWpaQCk3FQsIlgAA4C8aL8NOCft0ygp/qnoJR5y/sparqmeoeuGV7UhlM1dn2464iqoXVZ3SO2IZVv2WsPm8imNXzdKoTiFXsUfVLMOQOCn/bLUUQgipSUsIKaQQupLCkpFWXEarPgMPrJ2/b/2WuMwWzS+8Nnf53JIdayPKC2L0csPyKWVpUkmpLGEKTVqWsDQtoHQhNF2ZurKqWHnAkLrp10yf0j1lhtQsM8YKCJ9VYiTtiUyNad21YbfefuXZsHJFevMOya37SCNOE0Io09KVKexxXxmsBwRLAAAA4IRS/79dUwlhSaVLIZQQf47aamrCDHgSU7uP8u3bvnXpjJTWmSkDR5c073J4ySx/YXa8WeTW9YC/XAjTpUlhKSWkKaVlj98jlBBmFWv3lJma4fIb0idNoQlNuor9kX5PQ6tpx8QO3aJbdtuydr1etrPt6QNdKR2U9GhKCWEK5ReWXqZ5oo5wCydAsAQAAACOQ7AUTpuf/cQOUyjdHiBWCGFZPk0Jt4pUUtMzOrQ9P+XQjpXbf1sSn9Kw8YV/K9yV49v8n8KcPbrmdVlet+U3LL8Uli6kJqQlhRLSlFWNHmS4jHLh9gm3CChdk8WR0YE2HRqe1k9Gpebn5G36z/wmHbsmZ56tu+MD0q0sobSAFH4lDUu6XdxqDoIlAAAAUC+C5f9/9qOSQgmlCWEJIZVQQli6cClLSimFZSndMGPS0toNSEpK2bt7y6p1OxunN0ocfFlUYV7R3u37N66O8Rd7fEUes1xXASksISwlharywt6rW6VK80Ume7X4pqf1jGiQGJWSsu9Q/t7tm9KTM7v3H+KJT/G7Giil3Mpn6YZfappyC2loljQsy47AAMESAAAAqA+kEJpwMqb4Y6xYqQwpNVMGpG64lHKbAVOPtFK7N2nYMbM4a/fODVs2702Mikht2rF9h25W4aHD2zfKQGl5YUHBgRxNWcrya9KSwbdBKiGEVELqLldicrIrIkK6ojO69DajUrIK/GWFZdaqPY2Tknv27KrFNgwY0UppLssnpCF0Q1oBS7r9UvMooSnzzw0GCJYAAADACfXnqK1SiP/TZ1XaTZn2kK32xbmUQro0pTxSCleEFd+8aZdmmSXb8vbtKSss3L1tj9Rk4xZ941ITy8tKVO4hXUihvFL3y0BAmJYQQuiGkLqSmlJS6npEYpIemXJ4776d23ICVlFKWkaDBkmpXftoRpQlXZbSDaULKZR02YlUSt2j/simSiNVgmAJAAAAnMycx5loUa0SWzSXhkr2Fquyw3u3/Z6z8nfpO9wgxvDrViAqVvjdUriksIQSIqBbSulKWH7T5/flZO8o0w4lJSd3PuNMzeOWRoSmu4QyLCGlNJSQQso/204BgiUAAABwCkVK8ecDPIUQUmqGIX3SkhExnsio1nGJMuAVgTJf2eHCkny/cAkVIYUSypJKKCGVUpoSmsuTEh0TERMjNUNomrCXqWlCMyxLSs1lKU1IqZSQ3EQJgiUAAABwqvojWxplQim30JWSSulKjxFarIzQjEiV1FAGhBKalMISyn6siVKWkJomhFBCWkpowlRCKcsSUkipmZYSQpNCN8X/H1MIIFgCAAAApyYppZTSKwxNSsPSpJJKaJYmA5oQQrh0Kex0+OeoskIJKYW0Q6VSQkoppCUMIYTUpRLKUqamaUoIy7J0TVdKSZIlCJYAAADAqU0ppQuPpoRU9jNKhFJ2M6NS0lKa0oS0pFRCCKlJKZRzw6TUhBJC/tGxVvzx0hBSSaF0XUplESpBsAQAAAD+GlftZkBIqaRUmhBS6kLoSgghlBSmJiwhldCchPh/BnKVQvw5sxBCSfXn/yoR1AdWkS9BsAQAAABObUqTlpR+KSwhDCFcSkjTEkoJqZSuNGk3Utrx8M/xfoQUf4ZHqYT9WBOpnGwZlDsBgiUAAABwygtouvVnEFRCKKGEJoSlhLSksqSSQgkhrZCHhmjOm+wEaUkphBRCKvlHBpU8ZwQESwAAAOAvcdWuTKGEVFIJqTQZkNIvdUvTNKEMIXQlNPHHEDx2uLRz459xUriE306RQggl5J8dX6WTKiXPsQTBEgAAADjVSScnSqEMJbQ/kqIUdrvkn31atT9G9bH/5fyP/sdSlBD//6GV/+c2S4BgCQAAAJzqwVL+n5SpHzGGVjKBJIm6oFEEAAAAAACCJQAAAACAYAkAAAAAIFgCAAAAAAiWAAAAAAAQLAEAAAAABEsAAAAAAMESAAAAAECwBAAAAACAYAkAAAAAIFgCAAAAAAiWAAAAAACCJQAAAAAABEsAAAAAAMESAAAAAECwBAAAAAAQLAEAAAAAIFgCAAAAAAiWAAAAAACCJQAAAADgJGZQBAAAVEFKSSEAAFA1WiwBAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAAADBEgAAAABAsAQAAAAAECwBAAAAAARLAAAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAABAsAQAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAAADBEgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAECwBAAAAAARLAAAAAADBEgAAAABAsAQAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAECwBAAAAAARLAAAAAADBEgAAAABAsAQAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAAADBEgAAAABAsAQAAAAAECwBAAAAAARLAAAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAAADBEgAAAABAsAQAAAAAECwBAAAAAARLAAAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAABAsAQAAAAAgGAJAAAAACBYAgAAAABOIgZFgJPR/Pnz/X5/hYmdO3dOSUk54ntN0/zpp59Cp/fs2TM2NjZ0+po1aw4ePBh2UZmZmW3atKnmNi9ZsqSkpCR4SlJS0mmnnRY8ZdeuXVu3bq1+OfTt2zcyMvKnn34yTbPCn9q3b5+RkVH9RRUXF//666+h0/v06RMVFXXEojiis846S9f16petEELTtJiYmJiYmPj4+PT0dCnlsZwzu3btWrx48bJly/bv319QUODz+eLi4hISEtq0adO1a9fTTz+9YcOGlb2xBgel+rsphDAMIyYmJjY2tkmTJhEREbX7YVFKvfHGG6FniO1vf/uby+Wq/tJO7L6c2O2p9fO/tnYwMjIyKiqqQYMG6enpmqbV27q01svweFbO1bF///4FCxasW7du06ZNBQUFRUVFpmnGxMTExcU1b968c+fOPXv27NChw7Gf9jWuzepJfXKMlWpdf3HU9Sf9BB4+oM4p1IFvv/02uJAXLFhAmdSusNXutGnTqvPe4uLisJ+F3377Lez8F1xwQWUfn0aNGpWUlFRzmzt27Fjh7cOHD68wzzPPPHNUn9+tW7cqpQYNGhT6p1tvvfWoivTtt98OXUhiYqLf769OUVQnuB5V2VYQHR3ds2fPW2+9dd68eYFA4Kh2bdq0aQMGDKh6+VLKvn37/s///M+ePXtq5aDUbDeFEE2aNBk9evSrr766ffv2WvmwLFy4sIrVzZw586iWdmL35cRuT62f/7W+UpfL1apVq0suuWTSpEmh5+EJr0trvQyPZ+VcBa/XO3ny5J49e1ZnL1q2bPnoo48eOnSoZufDMdZm9aQ+OcZKta6/OOruk37CDx+4RK9rdIUFai4rK+tovyDrwuWXXx468euvv1ZKVX8hX3zxRejEiy++2DDqRb+GkpKSpUuXTp48+eyzz27UqNEbb7xhWdYR37Vv376hQ4decskl8+fPP+JPbIsWLZowYULTpk2HDRt2VL+m167du3d//fXXt99+e4sWLc4555yZM2ce4wI//PDDGv+1vu3LKbY9tc7v92/dunXatGm33XZbq1atzjvvvF9++YXKuU599tlnLVq0uPXWW5cuXVqd+bdt2/bkk082bdr0qaeeqqzdrz7XZiewPjluXxx14WT8MgJqgGAJHJNnn312165dJ3YbLr744tC+N9nZ2cuWLavmEoqKiubOnRs6/YorrqiHZZ6TkzNu3Li+ffvm5eVV/UV+5plnzpo166gWblnWf/7zn3rSE2nu3LkjRowYMmTIpk2baraEQCDw2WefVTHD119/XaETYL3dl1N7e+rC7NmzBwwYMHHiRCrnuuDz+a6//vrLL788KyurBoHn0UcfHTBgQE5OTjVjSX2ozepPfVJ3Xxx1lCpP9i8jgGAJHA9er/e+++6rraUd1d1uQgg7TyYlJQ0ePDj0r19++WU1l/P999/7fL4KE1NSUgYOHFhvS/7XX38dNGjQ4cOHK/tKHjly5Pbt22uw5CuvvLJBgwbHeFBq0bx583r06DFt2rSaxadDhw5VMUNpaek333xz3I7asezLX2F7ap1S6h//+EfYju5Uzse48AsvvHDq1KnHspBFixYNHDgwOzv7iAGjtmqzY1Rb9ckJrFSr/uKoC/Xn8AEES+AkMG3atJ9//rlWFnX33Xd/8803/fv3r3o2t9s9duzYDRs2NGvWzJ4StjfsV199Vc31hu0He+mll9Z6Rqpda9aseeyxx8L+6e23316xYkXNFnv77bfXykGpRSUlJZdeeuk777xztG+sTs+0f//738fzqNV4X/4i21MX7rjjjoKCAirnWnTLLbd89913x76cTZs2jRgxIvR3vTqqzY5RbdUnJ7ZSreKLoy7Un8MHHAeMCgvUgjvvvHPFihXHHsOklCNHjhw5cuSSJUv+8Y9/zJkzJ3SGCRMmjB8/Pi0tLXj6RRddNG7cuEAgEDxx8+bNGzZsaN++fdUr9Xq9Ya+QqtkPtkWLFp07dz7ibNUvHHuBSimfz1dYWLhjx44qftGfNGnS+PHjW7ZsWWH6q6++Gnb+li1bXnfddS1atPB4PHl5eZs2bfr1119//fVXp+h69uzZvXv3Wjko1S830zTz8/MPHjy4ZcuWKu6Mvfnmm5OTk0eOHFnNVZSVlYX+uDBq1KgKTQo//PDDoUOHkpKSanzeHod9qbfbU+vn/9Gu1LKs8vLy/fv3b9q0qbJ8UlZW9uWXX44dO7Z+1p91Woa1VTlXyFdVtFWmpKRccMEFZ5xxRmpqqtvtPnDgwObNm7/55pu1a9eGnX/FihUTJkx44YUXKltgLdZmx6IW65O6qFRr5YujLs7SenL4gOOE8YsYcopRYW01GBU22Ouvv167Aw+GvR8jOjq6svmHDh0aOv9TTz11tKerrVGjRpZlVacoxo8fX7tDeoYucNeuXRMnTnSeelLB//7v/4bOH3bOW2+9NXiQW0deXt7UqVOHDBkipXz//fdr8aAcbbnl5eV9/vnnvXv3ruw0a9iw4f79+6tZvJ9++mnoEtatWxfaD23y5Mm1e8hqfV/qw/bU+vlfuztYVlb22WefNW7cOOzeXXHFFfV2VNgal+EJqZxLS0vT09PDrigqKur555+vbPTRuXPntmjRorI0snnz5rDvqrva7GjVRX1Ss0q1jr446uIsrT+HD1yiMyoscDJ55JFH8vPzT+AGhG1grM5tlmHnufTSS4/xuZG1qEmTJo8++ui8efPCNjt8//33FaZs3LgxbGx44YUXwg5y26BBg2uvvXbOnDk7d+687LLLTuCeNmjQ4JJLLlm8ePGHH34Y9qGLubm599xzT/XbVSpMadu2bceOHUNvna2L3rC1uy+n3vbUuoiIiEsvvfTnn3/2eDyhf923bx+Vc62YPHly2KYwj8fzww8/3H333ZW1jp599tlLly5t1apV6J9M03z88cfDvqv+1GYntj45Dl8cdeHk/TICaoZgCRy1G2+8MexVaWVXBsfHBRdc4Ha7K0xcvnz5nj17qniXaZphx1qoh+PB9u7dO+wX7e7duytMCTvQYteuXcNecFe4EDniPMfHVVddNXfu3LBXHh9//PHmzZuPuIT8/PzQKye7WXv06NEVpi9cuLDuxs889n05tbendrVo0eLss88OnX78R8I8VSvnN998M+z0l19++Yg3DTZs2HDGjBlhc860adPC3gdbT2qz+lOf1N0XR104Bb6MAIIlULe6dOly/fXXh06fNGnS+vXrT9RWxcfHn3feeaHTp0+fXsW7fvnll9BR/po2bdqrV696WPJ9+/YNnXjgwIGK9ZoWpmarejDDeqhfv35hHxShlHrllVeO+PYvvvjC7/dXmDhs2DAhxKhRo8Jmqnq7L6f89tSulJSU0IkxMTFUzse+/OXLl4d9Pk379u3DZtpQ7dq1C3uzq8/n+/zzz8NcpdWP2qxe1Sd19MVRJxfZp8SXEUCwBOpQSUnJ008/HXqhZprm+PHjT+CG1aA3bNi/hh1jtj4I24MxtMtuampq6GyrV69etGjRyXWm3XPPPWHHwKjOeL+h/daioqIGDBgghMjMzOzWrVuFv9Z177Vj2Ze/wvbUoh07doTNM1TOx778sM/7FULcfvvt1R8f6I477qj+wutJbVbf6pO6+OKoC6fMlxFAsATq8NolLS3tkUceCXtlcDyfCljBqFGjQjvPzJ8/v4pecGEvo+thP1jb1q1bQydmZGRUmBI6FIdTPj/88MNJdKa53e4bbrghdHpWVlZlI0w6M4Q+ZeGcc85xTo8RI0ZU+Ovvv/9e9TJP1L78RbantqxZs2bBggWh04cMGULlfOyVc2UPL7nwwgurv5DOnTuHHY807MLrQ21WD+uTuvjiqAunzJcRQLAE6vDaRQhx9913N2/ePPSvd999d9UPJas7MTExdt+kYKZpzpgxI+z8Ye/AbNWqVejPz/VBeXl52O5VXbp0qTAlPT29X79+oXPm5uaef/75F1988bZt206Wk+2cc84JO3316tVVvOvTTz8NfbTGRRdd5LwOvS1KVO8hdcd/X/4623OM/H7/F198cf7551uWVeFPqampR5V8qJwrs27dutCJbdq0qWyc2MqEvRszJycnNze3HtZm9bM+qfUvjrpwKn0ZAdXBcyyBGl67eDye5557LvjL1bZ9+/YXXnhhwoQJJ2TbrrjiitBGyK+++uq6664LnblW+sF+8sknS5YsqXqeDz74oHXr1sdY5tdff33Y4Rauuuqq0IkPPPBAZY8i+PLLL6dPn37DDTc88sgjtfvc7brQo0eP6l/gVnFJp2na8OHDnX927949MzOzws8KH3300dNPP113PcRqti/1rWxPyPlfwYwZM3bu3Gm/VkqVl5fn5uZu3LjRrppCvfzyy5U9dKE+qMUyrNPK2efz7d27N3R6p06djnZRlb1l+/btoQ+AOeG1Wf2sT+rii6MuztJT5ssIIFgCdRgshRAXXnjhoEGD/vOf/1SYYeLEiddee+3R/oZdK0aMGBEVFVVaWho88YcffigtLQ29sgwbLK+88sqjWmNOTk7Yge+CVdieqnm93sOHD9vPuT58+PC2bdt+/vnnqVOnhh3iv1OnTmEf4Dlq1KgLLrigsoGLTNOcMmXKu+++e9111/3Xf/1XkyZN6u3JlpiY2KBBg9CHJVTx7O/NmzevWLGiwsR+/fpVuGAdPXp0hYFq9uzZs3DhwiOObHk896W+le1xOP+rY/v27du3b6/OnLquv/TSS/X8uQW1WIZ1WjlnZ2eHNtwJISp7OmUVKnvLnj17zjjjjHpVm9Xb+qQuvjjq4iw9Zb6MgOqgKyxw1IIfC/7SSy+FDvtWUlLy4IMPnpBti4qKCr3dpby8PPR2jo0bN4Y+YqtDhw6V3RNy3Lz++usJCQkNGjRITU1t06bN0KFDn3nmmbAXB4ZhvP3222GfGyGE+Pe//929e/cqVmSa5jvvvNO6deu77767qKio3p5v8fHxoROr2OCwPdBC+6qF7RtZ173XjnZf6lvZnkQyMjLuuuuujRs33nbbbVTOtVI5V9YgHPYsqlpsbOxRreIE1mb1uT6piy+OunDKfBkBBEug9gV/93fu3Pnmm28Onef9999funRp8BSXy3V8Ni9sX9bQxsmTa9ieULquf/bZZz179qxshpiYmP/85z+hN51W4PP5XnzxxQ4dOsyaNat+7mlcXFz1L0CFEB999FHoxNC+WGeeeWaDBg0qTPzss89CHypwAvelvpXtSeTw4cM7duxYuXJl6C2XVM41q5wrazWtwaNcjjZYnsDarD7XJ3XxxVEXTpkvI4BgCdS+4B/FhRBPPvlk2F+s77jjjuB+U8ftHqdhw4aFXuh8++23gUCg6qgp6vGDRipIS0ubM2fOEccjiYuL+/bbbydNmlTZZZxj7969w4YNe+mll+rhzpaXl4dOdLvdYWdevnx56BCIHTp0CB2F0jCMkSNHVpiYl5c3e/bserIv9a1sT7qINX369Msuu6xr165/nQFC6rRyrqyNq0LVWh2Vxa0qIu4Jqc3qeX1SR18cdeHU+DICCJZA7atwGZGUlPT444+HzrZ06dLgZ3kdt2AZERER+sTqgoKCn376yfnnnj17fvvttwrznHbaaW3atKnnha/r+t///ve1a9cOGjSoOvNLKf/+979v37797rvvrjowKKXuuuuuF154ob7tcuhNgEKI6OjosDOH7XtW2dARx7/32lHtS30r25PU2rVre/bsGXb8Eirno6qcKzsxCgsLj3Y7K+vuWPWWHP/arJ7XJ3X3xVEXToEvI+CIGLwHqAW33Xbb66+/vmnTpgrTH3jggQsvvNBuPzyeV6uXX355aP+lr776ynmW3ddffx36rqMdtsd29dVXP/TQQ1XPE/ahbTXTvHnz5557LuwDr6uQlJT0/PPP33333c8888zbb7/t9Xorm3PChAkDBw6s+n6Y48nn84V9DGnYh7BZlvXJJ5+ETk9OTg77iDy32y2lrDAeyddff11SUlIXp+tR7Ut9K9t6cv7b/va3v/33f/+380+/319UVLR169Yff/xxypQpBQUFFebPy8u76aab6lXb0XErw1qsnBMSEsJOP3To0NFuVehjRWzVuV3zuNVm9bw+OQ5fHHVxlp68X0YAwRJ/LWHH66vxbEfF5XK98MILoXdQ7N+//6mnnnr66afFcWyxFEKcf/75cXFxFX5H//rrrydNmmS/Dvtky5oNHZmUlFS74/0kJCSkpqY6V2wVrsC2bt368MMPP//88zVYcmZm5qRJkx599NEnn3zyrbfeCtsbze/333PPPcGtuyfWqlWrTNMMnR52bPqff/457GAV99xzT/XXWFZWNn369KMdi7/W96W+le1xO/+rIzIyssKYnGlpaa1btx46dOg999wzcODALVu2VHjLnDlzVq5cWc1H1B7nurROy7AWK+fk5OTo6OjQ2yA3bNhwtFtV2VuqP8DscajN6nl9cty+OOriLD0Zv4yA6qArLE4dRzsefe0aOnTo+eefHzr9+eeft29wioyMPG5F4Xa7Q0ft27dvn/2AvrKysvnz51f46xlnnBH2keLH33XXXbfxTwsWLAi9r+nFF19csGBBjZefnp4+adKkNWvWhH1utX05VX/6DS5atCjs9LDPYKytXmfBvQRP1L7Ut7I9WaSnp0+ZMiXsn6rfYnli69L6XDmHbZJau3bt0WbsNWvWhE6UUh5tJVyntVk9r0+O8xdHHX1aT6IvI4BgiVNW2NvfQzuAhVVZH6RjD34vvPBC6JeZz+e79957hRDH0gmnBsKO7zpv3jz7ejq0+039HA+2ffv2999/f4WJSqnrr7/+GC9q27Vr99NPP11zzTVh/7pw4cJ6UgLvvvtu2B8OQpuefD7ftGnTamWls2fPrkHvvlrcl/pWtieXAQMGJCYmhk4P20pWP+vSWldblXOvXr3ClsOSJUuqvzFlZWWhD9gUQnTp0sXj8dST2qz+1ycn5IujLpwsX0YAwRKnrOTk5NCJv//+e3XeW9lsld0/c1RfD2EfGTd9+vS5c+ce52A5ZMiQ0MHf7U41Ya9p6u0j1B977LHQX/G3b98eet1wtAzDePPNNxs3bhz6px07dtSHfZ87d27Ylo0hQ4aEdt77/vvvDx8+XCvrNU3z888/P4H7Ut/K9qQTNliGvaG0ftaldXHtXiuV88CBA8NO//jjj6u/MTNnzgzbJlzZwk9IbVbP65MT+MVRF+r/lxFAsMSpLOzoGtW8FWHu3LmhE2NiYtLT0499wx5//PEK9z7Z7rzzzuP5OGYhhMvlCh2jb/78+Uqp0HEX+vXrF/YrrT6IjIx87bXXQqdPnjzZboA9xoUPGDAgdHpZWdkJ3/HDhw/fdNNNYf907bXXhk6s3dEXa7f32tHuS30r25OLaZphb40L+yiLeluX1rpaqZyHDh0athjfeuutffv2VWcJSqknn3wy7J8qG231hNRm9bk+OeFfHHW0wfX2ywggWOIUF3bE8M2bN//4449VvzE3NzfsMHc9e/aUUh77hiUkJIS9aNiwYcMHH3xwnEsptHdrXl7emjVrli1bdsQ565Xzzz//0ksvDZ1+ww03hB3of/369dVfeNhn0IVtxjme8vLyLrjggl27doX+qUmTJhdffHGFiUVFRWEHZGrUqFHbI2natGnoGxctWrRz584Tsi/1rWxPOj/88EPY/n5h8169rUtrXa1UzomJicOHDw+dXl5eftttt1XnTstJkyatXr06dHpmZmbYY3FCarP6XJ/U3RdHXTgFvowAgiVOfeeee27Y6TfeeGNOTk4VtfaNN94Y9hsldKibGrv55ps7deoUOj1sG0KdGjx4cFJSUoWJb7zxRoUbLKWUl1xyST0/4i+99FJcXFyFiXv27Ln77rtDZ7722mtbtWr19NNPH7ENoaCgIOyIJo0aNTqBOztjxoyePXuGHdBfCPHss8+GNrB8/fXX5eXloTMvXrx445GsX78+bFfAo+rdV4v7Ut/K9uSSnZ0dts+nEKJdu3YnV11a62qlcg5b59ifwTvuuCNsNnBMmzZt/PjxYf905513hg3kJ6Q2q7f1SZ1+cdSFk/3LCCBY4i+hffv2/fv3D52+c+fObt26ffDBB6GDdy9btuzss8+ePn166Luio6PHjBlTW9um6/pLL7107MsJ++P3UY09qOv6RRddVGHip59+WmHKwIED09LS6vkRT09PD35wn+Odd9757rvvQqdv27bt4YcfzszMHD58+EcffbR///7QeXJyci688MLQcUp0Xa/sIdrHflDCOnz48Pbt2+fOnfvoo4926dJl1KhR9mCVoS644ILLL788dHrYfmvdunXLzMw84tqjoqKcB5wGq1nvtWPfl9pV37anLpimmZ+fv2zZsieffLJLly6VNQ2FjXz1uS6tdbVSOQ8YMKCyND5p0qQzzjjj+++/Dy20FStWXHXVVZdeeqllWaFvzMjIuP322ytbYx3VZlU4nvVJHVWqNfviqAvH//ABJ5JCHfj222+DC3nBggWUSa2rrM3B+W4788wzL7vssmuuuWbYsGFV/+b36KOPVrGi0PteevToccTNq87P9sOHDw/73tzc3CeeeKKyDjDdu3f/9NNPA4FAdUrpiP3ZhBCvv/56Ncv8WG4BKi4uruYCx48fH3btpmmefvrpYS8d8vLygucM+7iIdu3aXXDBBTfffPMDDzxw2223DRkyJOy9UkKI888/v3YPyjHeOuXo2LFjQUFB6PIPHDig63ro/I8//ng1j2xlD6hYs2bNcd6Xo3U8t6fWz//juYMjR4484XVp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3XjjjfbrFi1azJkzJy4ujjMQAMESAOq7TZs2/fbbb40aNTrrrLMojRNrzpw511577f79+6sz84EDB+wbaB3JycnO66SkpFO1lP4iu/mX9cQTT2zcuFEIkZGRMW/evLS0NM5AAARLAPXF6aef3qNHj6rnSU1N/ctexn300UfDhw8nWJ5Yb7/99s0336yUcqZ07Nhx5MiRXbt2TUlJ8Xg8BQUF27ZtW7x48ffff19QUCCEePjhh4OX8K9//euaa67Jycl57LHHMjIyTtWCOjV2k0oprCVLljz99NNCiKZNm86bN69Zs2acgQAIlgDqkdGjRz/yyCOUQ6hAIPDdd99RDifcF198cdNNNzn/7Ny584svvjh48ODQOe+44w6/3//dd98tXbq0e/fuwX8644wzNm3adMqX1amxm1RKYX300Ud9+vRJTk5+/fXX622u/ot80AAQLAHgKMyfP99u+8IJtHPnzuuvvz44cnzyySdVjAjicrkuuOCCCy64gKLDKebll1+mEAAQLAHg5DN9+nQK4YS7//77i4uL7dfnnHPOtGnTdF2nWAAAIFgCOHWYprlw4cLFixevWrXq4MGDRUVF0dHRqampPXr0GD16dKtWraq5nOzs7OnTpy9cuHDr1q2FhYUejycpKal9+/b9+vU799xzExISnDk3b978/fff268vv/zyqseu+Oabb3bs2CGESE5Ovuqqq6q/X/n5+a+//vp7771n/3P79u0VxquMioq6+eab66hAfD7fd999N2PGjG3btuXm5jZs2LBx48YjR44cPXq03VJXW8mqFlfk9Xpnzpw5a9as33///fDhwx6Pp0mTJv369bv88sszMzNrvIUbNmyYNm2a/TohIeG9996r8b7/+OOPa9euFUJERETccsstVc+8ZcuWzz77bMmSJVlZWT6fLzExsVOnTvbDPDVNO+IqLrzwwiZNmgghLMv65Zdfvvrqq/Xr1+/fv9/lciUnJ/fo0ePCCy884j2ENfh0VH83j/1EXbly5TfffLNy5cp9+/aVlJREREQkJCS0adOmR48e5557rr37J9ZRlVuwffv2fffddz/++GNWVlZubq7H42ncuHGvXr0uuuiidu3aVbHG0tLSt956SwiRnp5+2WWX2RNzcnK+/vrrefPm7d27t6ioKD4+vlWrVgMHDrzsssuio6OruS+1u0mbN2/++OOPly5dmpWVFRkZmZ6e3qtXr6uvvrpx48bB7y0vL//++++/+eabnTt3Hjx4MDY2tmXLloMHD77iiiuioqJq5YNWs2O0b9++efPmLVu2bPv27QUFBZZlJSQktG3bdsCAASNGjHC5XFWvtLCw8JtvvlmwYMHGjRvtt8fExDRq1Khjx45nnXVWv3793G43X+5AfaRQB7799tvgQl6wYAFlgqO1c+dO5xR68skna7CE3bt333XXXcEDAIa66qqrCgoKql7OgQMHbrjhhgqPHAzm8XiWL1/uzP/JJ584f1qyZEnVCx8+fLg952mnnRb6V+eip2HDhsHTH3744Soum2ypqal1VCCzZs1q2bJl2LenpaV99913SqlBgwbZU4YPH17jc6AWVzRt2rTK0qNhGPfcc4/f76/ZRo4fP95Z1BNPPHEs53xlh7uCQ4cOXX311ZUdwbZt2/72229HXMUbb7yhlFq+fHm3bt0qW9T555+/f//+2v10VGc3j/1EXbNmTf/+/av+gPTt23fdunXHuVI6lnJzjv7f//73KpLJqFGjdu3aVdl6nSGL09LSlFJer/fxxx+vbGnx8fFTp0494r7U7iYVFxffeuutYZcjpXz88ccty7Lf+M0331R2G2dSUtL3339/jB+0Ghwj0zSnTZs2YMCAKp7bmZaWNmPGjMpWaprmU089FRMTU8Wpm5CQ8Nhjj3GRAC7R6yGCJWctTtlgOXbs2Or8utS3b1+v11vFFeoRhw1MSkry+XzHM1hWFreqDpa1UiBTpkw54rPOX3311csvv/wYg2UtrmjChAlH3OvBgwcfPny4BtvZtGlTJ6BmZ2fXdbDcvHlzhUabUBEREZ9//nnVq7j11lvnz59/xJaTNm3aVFEsNfh0VGc3j/FEXbBgQXXa2SIiInJzc09IsKxZuSmlNm3a1KJFiyPuWnx8/M8//1x1irNb1YYNG3bEpdm/QVSmdjcpKyvriKNb33vvvUqp559/vurZdF1fuHBhjT9oNTtGu3btOmKtZSfkb775JnSllmWNHj26Oif/hAkTuEgAl+gES85a4Phdwy1btsx+++mnn/6vf/1r8eLFe/fuzc/P37Bhw4svvhj8+LJJkyaFXcLevXuDO7ImJyffddddn3322Y8//jhz5swXX3zx4osvjouLu/POO4PfdRyC5fz582fNmjVr1qzmzZvbM5xxxhmz/q8ff/yx1gtk/vz5wR/tYcOGzZgxY/v27bt37166dOmzzz7rpCznmqxmwbIWV/Tcc885y8nIyHjxxRc3bNiQl5e3a9euzz777IwzznD+OmbMmKPdTrsbs5NzjvGcP+L1bl5eXnAHzssuu2z27NnZ2dmHDh367bffHnzwwYiICPtPbrd7/fr1VayiefPmiYmJ9hX/vffe+/33369du3bz5s0//vjj3Xff7SxHCHHXXXfV4qejOrt5LCeq3+93isjj8UyYMGHx4sU5OTkFBQW7du2aO3fuE0880blzZyHETTfddPwrpWMpt4MHDwZHnS5durzyyitLlizZvHnzb7/99s477zit93ZP+NWrV1ed4pyTf+DAgW+88Ya9qNWrV7/33nvBvaA9Hk9lDde1vkn2ejVNu/7666dPn75mzZqNGzfOnDnzoosucubRNO3ZZ5+1+3tnZGQ89dRTCxYs2LRp05o1a6ZMmdKmTRtnzrCVanXOwBofI6WUndVjYmJuuummzz//fPPmzbm5ufv3758zZ07weF0ZGRmhP4vYXYJtPXv2/Pjjj7du3VpQUHDgwIE1a9a8//77V155ZXR0tKZpVbQAA1yiEyw5a4E6uYabOHHiihUrwv5p69atsbGx9vK7du0adp7gn/MvuuiisF3vvF5vfn7+cQ6WjtNOO+2o8tuxFIjf7w9umnjmmWdC5ykpKRk6dGjwx78GwbIWV7Rx40anJ1vPnj3z8vIqzBAIBC688EJnITNnzjyqTf3mm28qNKTUabC85pprnNV98MEHoTMsWrTIGY22Z8+eTqfB0FXYunXrduDAgdDl/Prrr85yoqOjy8vLa+vToarXXlTjE3X27NnOVs2aNauy5a9fv3737t0npFKqcbkFx5L77rsvEAiEvnHKlCnOPB06dAjt4B2c4mxvvfVW2M/gpZde6szz1FNPhd2Xutgkj8cTtm2zwkNfhRCDBg0qLi6uMFthYaH9w4Et7Fl0xDOwxsdIKbVgwYI333yzqKgo7JL//ve/O0uePn16hb/26dPH/lO/fv0q65xfWlo6f/58rhDAJTrBkrMWON7XcFW74447nI5JodcBixcvdjagd+/e1b8Hrz4Hy2MpkK+//trZr5EjR1a2kMOHD9tNYTXesFpckTMWSHR09J49e8IuJzc3Nz4+3rmeO6pNDe6P984779RpsFy/fr2zrvHjx1e2kEcffdSZbe7cuVUES4/HU0W4evDBB505Fy9eXFufDlXtO9xqdqJOmjTJ/lNsbGydVkpnn332k0cSGkhqXG6rV68ObsCvYs7gAPbmm29WneL+/ve/V7acvLy8yMhIe7Zzzz33uG3Sf//3f1f2e1NwK2J8fHzY30SUUj/88EPVnS+qPgOP5dw+ooMHDzpja91///0V/uq0xj///PNcA4BL9JMRo8ICJ4FNmzYFXytUdo/cEW8Yq6B///6vvPKKPYhXTk5OhfESgnslvfjii1UM4XDKqLpApk6d6ryeOHFiZQuJi4u75ZZbnn766RpvRm2tKDc396uvvrJf33zzzZXdmpiYmHjllVe+/vrrQoiFCxfm5ORU/8Hu+fn5wcup06PjnJAulys4PVZw22232e1LQogvvvji7LPPrmzOMWPGVDEc7iWXXPLMM8/Yrzds2NC7d+/68+mo4kR17q4sKirKyspq1KhRHW3DvHnz5s2bV/U811xzjfObxTGWmxOY7Tb8KuZ85JFHXn/99by8PCHEa6+9FnZoaMdDDz1U2Z8aNGgwePDgmTNn2ifA8dkkwzCC2/Qq/Oncc899//337X9ee+21lQ3vNHjwYI/H4/V67e+OGn/Q6uLcTkpKatOmzcaNG+17XCv8NTo6+tChQ0KI4F+RAJxENIoAqP8++OCD84+ksLDwaBcbfF1y+PDhCn91+tS1adOmV69ef4VyrrpAnB/yW7du7bSUhlXN8ScqU1srmjdvnt/vt187TZdhBd8J9uuvv1Z/U0tKSpzXFSJErXOeYXPWWWcF32dYQVpaWtu2bSuUZA1KL/heteD8XB8+HVWcqF26dHFeX3755QcOHKhXH7Eal9uPP/5ov+jYsWNwV89QUVFRF198sf161apVWVlZlc3Zo0ePqgeCcs6B0BOgjjapd+/eVXyOgnvIVzHskGEYzn6F1mN1d4yO9uwN3Tbn7H333XeDf18DcLKgxRL46wp+FJjdwuPIy8vbu3ev/frMM8+kQLKzs50ea0cskK5du2qaZllWDbahFle0ZMkS+4WUsoqHagghnDGQhBDbtm2r/tYGN5LbLSR1pKioyG7lEEKcfvrpVc/cvHlze+aq96XqMnHuYxRClJWV1atPRxUnardu3QYNGvSf//xHCLFw4cJWrVrdddddt912W/VboaupS5cuVacpEdR8eozllpubu3XrVvt1v379jjj/gAEDnGa35cuXV9ZsW/UJEHwOVDgB6m6TOnXqVM3y7NChQ3XmLC8vP6rDehzObefsrXDqCiHuvffeGTNmCCFM07z++uvfeeedhx566LzzzqvOSLMACJYAqiU+Pr6KZ4XbKnsovFJq6dKly5cvX7t27f79+/Py8g4fPlxWVlZWVlZUVFTZ0oJH+2zfvv2pVJg1K5Dg+6COWCBut7tx48a7d++uwebV4oqCY1XXrl2rWE5wJjyqpu/gTpg1aBupvuB9mTJlypdfflnFzE6LkH3/YdirUl3Xj/g0hRP76ajZiSqE+PTTTwcOHGj33iwqKpo4ceIzzzxz0UUX3XrrrQMHDqytzbvsssseeeSR41NuTtSp5huD53HiXyhnaOWjrVTrbpOq6Jtt/0LkvK6653mNk1htnduHDh36+eef16xZs2XLlry8vLy8vJKSkvLy8rKysoMHD1b2roEDB7788sv2HdRCiPnz58+fP79Vq1bjxo27/vrrGzZsyMUAQLAEcKzuv//+o72Gsy/0n3322XfeeSd0IMTqvNd53aBBg1OjGGurQKpzM2FcXFyNN7K2VmTf02VHlOrfauX0nq2O4GxWRQe/Y+fsixDi4MGDVVybVmBZlq7rodOr86THE/XpOJYTVQiRnJy8fPnyRx55ZNKkST6fzz6mn3766aefftquXbvx48ePHTs2uM3zeH4Aa1ZuwT1Rj/gTW4WFh+3FGvqzyNGqo02q/mkZ/ESc+nCMHD/99NPEiRN/+umnmnXZuOOOO7p16zZu3Ljff//dyeH33XffI488ctlll02YMKFjx45cEgAESwDH1fLly0eMGBF8Yep2u9u2bZuRkZGYmBgTExMVFbVv377PP/887NuDm7Cc5y7UhdDeUPW/QKpzSRcVFVWz7azFFQUvqvoXrEd1uFu2bOm8/u233+ru8AXvi9vtPtpxqkIdyxLq9NNxjCeqLTIy8vnnn7/vvvtefPHFt99+24nlGzduvPXWW5966qnJkyePGDHiOFdKNS634P6c1RlLJjg2BwKBujgH6miTqj9STh31Dj2Wc9s0zdtvv90eBsyRnp7esmXLpKSk+Pj46OjoqKioDz/8MDs7u4rl9O/ff+3atdOnT3/ppZd++uknZ8M++OCDDz74YMyYMS+//HJ1wjwAgiWAWrB3796zzz7b+e35sssuu+222/r27VvhquWHH36o7PLUGWdf/N8BWmpd6M1L9bNAgu+4Ky0tPeIa7ZaiGqjFFTmZs1GjRsE992pRt27dpJT2rwOLFi2quyMYnJ9fe+21G2+88QR+vuru03HsJ2qwjIyMZ599duLEiZ9//vlrr73mDGW0d+/ekSNH/utf/7rvvvtOinIL/lmkuLj4iPMHdxWuo8GK6+EmnfBze8KECU6qzMjIeOihhy6++OL09PQKsy1YsKDqYGnH5tGjR48ePXrjxo2TJ0+eOnWq86H44IMPfvnll8WLF9f6bcMAjh2jwgKnoEceecT5Gn7ppZc+/fTTAQMGhP4WXsUP58F3s9SsP141VdErrF4VSHCP05ycnCOusQaD9Nb6ilJSUuwXBw8erFm3tOpsrTMCys6dOxcsWFBHR9DZl7o+Iauj7j4dx36ihvJ4PNdcc82iRYuWLFkyZMgQZ/r999+/dOnSk6Lcgoe62bNnzxHnD56njm7Mq4ebdGKP0fbt252n2rZp02bVqlW33357aKo82rO3Xbt2L7300t69e5999lmnbtyxY8cNN9zAFz1AsARQ50zT/OKLL+zX3bt3v/POOyubM/i+tQqCuziuWrXqqDYguI9W1dcQSqktW7acFAXSvHlzZ7/WrVtX9Rr9fn/NRu6p3RU5Y2/4fL61a9fWUfEGP8jk5ZdfrqO1tGzZ0slXy5YtO7EfsWP5dNT1iVqFXr16zZkzx7n6F//3SYz1udyaNWvmtKStXr36iPMHL7zqB/bUWD3cpBN7jKZNm+bc1/Dcc89V9ozNmp29MTEx999///r169u1a2dP+f7774PHGQJAsARQJw4cOOB0YRo8eHAVc65YsaKyP0VFRTmPFJs7d+5RjVkf3Jmz6muIlStX1lZPwiru1ayVAomOjnZy2o8//lh1A+CqVauO6lf5OlrRWWed5byuehjVYzFmzBjnXrVp06bNmjWrLtbidrv79Oljv543b17Vw6LWtWP5dNT1J/eI7r77bufEsEeOrf/lpmmaM57tjz/+eMRKY/r06faLyMjIOkpx9XCTTuwxCh7qtoqzNz8/f+fOnTXbtkaNGr3xxhvOP53nDwEgWAKoK8E33VUx9qPX6636Ni1nbI+ioqL33nuv+hsQ/Ft11X3t3n///WPcWWd4m4KCgrouEKcb4YEDB+yHrVXm3//+97HsVG2tqH///k5XtNdeey03N7cuzreMjIxx48Y5/7z++uvr6ILv8ssvt18UFxe/+OKLJ/ZTVuNPx3H45B6R8wjEOn30aO2W2zXXXGO/KCsre+edd6qYc9myZc7tvpdeemn1h8M5WvVwk07gMQo+e6sYFemjjz46lgHbgp/eefzPXgAES+AvJyUlxelLuWTJkspmu//++6t+PsQtt9ziXB88/PDD1U8LnTt3di6L33333cpGtli3bt3kyZOPcWed4LRq1arKVlRbBXLzzTcHz1zZYxs3bNhQYVzEo1VbK3K5XPfcc4/9+tChQ1ddddURh0qq2a2YTzzxhPP8vZycnIEDB86bN6/WT+zrr7/eudPyn//85+zZs6ueXylVd2MO1/jTUdef3OpcbTs/9zRr1uw41041LrdLL720RYsW9uvHH388+LmmwUpKSm655Rbnn3fffXfd7Us93KQTeIyCb6f89ddfw86zZcuW//qv/6piIUc8e4N/qTz+Zy8AgiXwlxMZGdmzZ0/79Y8//vj6669XuLzOzs6+8sorX3nllaoHrG/SpIkzaGR+fv7AgQM//fRT0zSD5ykvL//8889HjRoVPN3j8QwdOtR+nZWVdfHFFx86dKjCwr/99ttzzjmnxkOnOnr16mW/KC0tvf3228MusLYKpFOnTpdeeqlzhXT++eeH3uQza9aswYMHH+N+1eKKxo8f37lzZ/v17Nmz+/Xr9/PPP4fOdvjw4WnTpl188cUPPvhgDTY4ISHh888/d8bJPHDgwJAhQ0aMGPHFF1+Eji108ODBGTNm3H///cOGDTuqtURHR7/yyiv2a9M0hw0b9thjj4VtqV69evXEiRNbtWpV4yGUjqjGn466/uROmTLlzDPPfO+998KWjM/nu++++5wHw4wePbrGJXDgwIFNRxJ63ta43Nxut/M7VF5e3uDBg0N/vNi0adOQIUNWrlzpnPxdu3atu5q2Hm7SCTy3gzve33777fv27avwK8/nn3/er1+/3NzcKs7eTp063XPPPZXdRL169Wonojdp0qQ+9ygG/rJ43AhwCrrnnnucfoO33nrra6+9Nnjw4IyMjPz8/BUrVvz444+BQEDX9S+//HLs2LFV9JB84oknli1bNnfuXPs68oorrkhMTOzevXtiYmJpaenevXvXr18fNts8+uij3377rX3NMXv27KZNmw4ZMqRl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AAAAAARLAAAAAADBEgAAAABAsAQAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAAADBEgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAECwBAAAAAARLAAAAAADBEgAAAABAsAQAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAAARLAAAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAECwBAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAAADBEgAAAABAsAQAAAAAECwBAAAAAARLAAAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAAADBEgAAAABAsAQAAAAAECwBAAAAAARLAAAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAECwBAAAAAARLAAAAAADBEgAAAABAsAQAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAECwBAAAAAARLAAAAAADBEgAAAABAsAQAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAAARLAAAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAAAIlgAAAAAAECwBAAAAAARLAAAAAADBEgAAAABAsAQAAAAAECwBAAAAACBYAgAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAAADBEgAAAABAsAQAAAAAECwBAAAAAARLAAAAAAAIlgAAAAAAgiUAAAAAgGAJAAAAACBYAgAAAABAsAQAAAAAECwBAAAAAARLAAAAAADBEgAAAABAsKQIAAAAAAAESwAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAQLAEAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAAAESwAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAQLAEAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAAAESwAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAQLAEAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAAAESwAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAQLAEAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAAAESwAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAQLAEAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAAAESwAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAQLAEAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAAAESwAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAQLAEAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAAAESwAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAIBgCQAAAAAAwRIAAAAAQLAEAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAAIIlAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAABAsAQAAAAAESwAAAAAAwRIAAAAAQLAEAAAAAIBgCQAAAAAgWAIAAAAACJYAAAAAAIIlAAAAAAAESwAAAADA/2vvPuOkqBK9ATfDDDktgiSJRhRBBAVFDIsKIkFMIBjWnPO6a14TeHFBV111r6JrRF1FUBAl6VXxJ0nEVQkKIhIlSB4y/X7o99bv3OqZoSeQ3Of5NN1d1VN1qrr7/OucOkewBAAAQLAEAABAsAQAAECwBAAAAMESAAAAwRIAAADBEgAAAMESAAAABEsAAAAESwAAAARLAAAABEsAAAAQLAEAABAsAQAAECwBAAAQLAEAAECwBAAAQLAEAABAsAQAAECwBAAAQLBUBAAAAAiWAAAACJYAAAAIlgAAAAiWAAAAIFgCAAAgWAIAACBYAgAAIFgCAACAYAkAAIBgCQAAgGAJAACAYAkAAACCJQAAAIIlAAAAgiUAAACCJQAAAAiWAAAACJYAAAAIlgAAAAiWAAAACJYAAAAgWAIAACBYAgAAIFgCAAAgWAIAAIBgCQAAgGAJAACAYAkAAIBgCQAAAIIlAAAAgiUAAACCJQAAAIIlAAAACJYAAAAIlgAAAAiWAAAACJYAAAAIlgAAACBYAgAAIFgCAAAgWAIAACBYAgAAgGAJAACAYAkAAIBgCQAAgGAJAAAAgiUAAACCJQAAAIIlAAAAgiUAAAAIlgAAAAiWAAAACJYAAAAIlgAAACBYAgAAIFgCAAAgWAIAACBYAgAAIFgCAACAYAkAAIBgCQAAgGAJAACAYAkAAACCJQAAAIIlAAAAgiUAAACCJQAAAAiWAAAACJYAAAAIlgAAAAiWAAAAIFgCAAAgWAIAACBYAgAAIFgCAAAgWAIAAIBgCQAAgGAJAACAYAkAAIBgCQAAAIIlAAAAgiUAAACCJQAAAIIlAAAACJYAAAAIlgAAAAiWAAAACJYAAAAgWAIAACBYAgAAIFgCAAAgWAIAACBYAgAAgGAJAACAYAkAAIBgCQAAgGAJAAAAgiUAAACCJQAAAIIlAAAAgiUAAAAIlgAAAAiWAAAACJYAAAAIlgAAACBYAgAAIFgCAAAgWAIAACBYAgAAgGAJAACAYAkAAIBgCQAAgGAJAACAYAkAAACCJQAAAIIlAAAAgiUAAACCJQAAAAiWAAAACJYAAAAIlgAAAAiWAAAAIFgCAAAgWAIAACBYAgAAIFgCAACAYAkAAIBgCQAAgGAJAACAYAkAAIBgCQAAAIIlAAAAgiUAAACCJQAAAIIlAAAACJYAAAAIlgAAAAiWAAAACJYAAAAgWAIAACBYAgAAIFgCAAAgWAIAAIBgCQAAgGAJAACAYAkAAIBgCQAAgGAJAAAAgiUAAACCJQAAAIIlAAAAgiUAAAAIlgAAAAiWAAAACJYAAAAIlgAAACBYAgAAIFgCAAAgWAIAACBYAgAAgGAJAACAYAkAAIBgCQAAgGAJAAAAgiUAAACCJQAAAIIlAAAAgiUAAACCJQAAAAiWAAAACJYAAAAIlgAAAAiWAAAAIFgCAAAgWAIAACBYAgAAIFgCAACAYAkAAIBgCQAAgGAJAACAYAkAAACCJQAAAIIlAAAAgiUAAACCJQAAAIIlAAAACJYAAAAIlgAAAAiWAAAACJYAAAAgWAIAACBYAgAAIFgCAAAgWAIAAIBgCQAAgGAJAACAYAkAAIBgCQAAAIIlAAAAgiUAAACCJQAAAIIlAAAAgiUAAAAIlgAAAAiWAAAACJYAAAAIlgAAACBYAgAAIFgCAAAgWAIAACBYAgAAgGAJAACAYAkAAIBgCQAAgGAJAAAAgiUAAACCJQAAAIIlAAAAgiUAAAAIlgAAAAiWAAAACJYAAAAIlgAAAAiWAAAAIFgCAAAgWAIAACBYAgAAIFgCAACAYAkAAIBgCQAAgGAJAACAYAkAAACCJQAAAIIlAAAAgiUAAACCJQAAAAiWAAAACJYAAAAIlgAAAAiWAAAACJYAAAAgWAIAACBYAgAAIFgCAAAgWAIAAIBgCQAAgGAJAACAYAkAAIBgCQAAAIIlAAAAgiUAAACCJQAAAIIlAAAACJYAAAAIlgAAAAiWAAAACJYAAAAIlooAAAAAwRIAAADBEgAAAMESAAAAwRIAAAAESwAAAARLAAAABEsAAAAESwAAABAsAQAAECwBAAAQLAEAABAsAQAAQLAEAABAsAQAAECwBAAAQLAEAAAAwRIAAADBEgAAAMESAAAAwRIAAADBEgAAAARLAAAABEsAAAAESwAAAARLAAAAECwBAAAQLAEAABAsAQAAECwBAABAsAQAAECwBAAAQLAEAABAsAQAAADBEgAAAMESAAAAwRIAAADBEgAAAMESAAAABEsAAAAESwAAAARLAAAABEsAAAAQLAEAABAsAQAAECwBAAAQLAEA+I176KGHFi9evNdt9oQJE1555RWHD/YE2YoAKHETJ05ct25d6u/atWsfdthhu3Fjli5d+s0330QPjz322PLlyztG/EdZv379d99917hx45o1a+4VG7x169Zvv/22cuXK+++//15d8hs3bpwyZUqVKlWaN2++J2/nK6+8cs899/Tv3//xxx+/5JJL9oqy3bJly9VXX/38889XqFDhxBNPrF+/vk867F5aLIGSd+WVV578vx5++OHduzGfffbZyYFFixY5QPxHGTduXIMGDdq0aVOnTp1+/frt+Rs8b9685s2bt2zZ8oADDujRo8eWLVv20pKfPXv2oYce2r59+xYtWnTs2HHTpk175nZu2LDhT3/6UyKRWLdu3W233ba3FO/UqVOff/75RCKRm5t75513+qTDbqfFEvYg06dPD9vW2rZt27BhQ8XCTvXDDz9MnTo1/flKlSpVq1atadOm1atX39v3MZlMfvHFF5MmTVq4cGFubm7t2rUbNWp02mmn1ahR4zd/fJPJ5Pnnn//rr78mEolt27bdddddp556auvWrXfSv5s1a9a0adPyfKlChQr77rtvgwYN6tSpU/Cb3HrrrTNmzEj9PWzYsKeffvrGG2/cGwv/1ltvnTt3burv0aNHP/nkk3/84x/3wO185plnlixZkvq7S5cu0fObN28eOnRoJu/QsGHDtm3b5vnS8uXLP/zww7lz5y5ZsqRixYp16tRp06bNMcccU6pUqUy+iNJVq1atY8eOiUSiVatWdevWTV0rHDx48D333HPQQQf5SgfBEkgkEokbbrhh3Lhx0cPLLrvsueeeUyzsVKNHj77uuusKWOCAAw644IILrrnmmr0xhm3ZsuXxxx8fOHBgVG+OZGVlde7cecCAAQcffPBv+PguWrQotu+TJ0/eecFyxIgRO8xOTZs27dat20033VS7du08F5gyZUr4cOLEiXtm2W7fvv3666+fM2dOIpF4+umnmzRpElvg66+/Dh9mGJx2/Wfkr3/9a/Tw5ptvjv5eu3Ztr169MnmTPn36pAfLb7755rbbbhszZsz27dtjL9WpU+fOO++8+uqrS5cuneEXUSTV/JtIJLKzs6+77rpUW+X27dsfeeSRQYMG+UqH3UhXWNiD6n8fffRR+Mxbb721x3ad4j/H7Nmz//KXvxxyyCEjR47cu7Z8zpw5LVq0uO2229JTZaomOmLEiGbNmj377LO/4cNXp06d2BWBli1b7t5NmjFjRv/+/Zs0afKXv/xl27ZteSaH8OGRRx65Z5btl19++fTTT48aNWrUqFFr165NX6BVq1bhwzZt2uyBezFs2LDoA3LiiSceccQRJfK2Dz74YMuWLUeNGpWeKhOJxOLFi6+//vq2bdsuXbq0OP/lyiuvjO6ZHzx48KpVq3xjg2AJJF577bVkMhk+s3r16uHDhysZ9gQrVqzo0aPHpEmT9pYN/u6774499tioR2V+tm7deuWVV8aayH5TP/NZWS+//HLlypUTiUSpUqXuuuuu/Los7mIbNmx44IEHunbtmh7JHn300WjMnk6dOl1//fV7Ztnu8LR57LHHDj/88NTf55577rXXXrsH7sULL7wQ/X311VeXyHted9119957b55XDWIFWMyBgqpXr37OOedEZ9Rbb73luxp2I11hYU/x8ssv5/nk2WefrXDYZf75z38efvjhyWRyzZo1U6dOffrpp6ObxDZv3nzzzTd//vnne/5erF+/vkePHmFjSIUKFXr27HncccdVrlx5/vz5w4YN++yzz6Ia/87rGronOO200+bNmzdt2rT999+/QYMGu/JfP/bYY40bN44Oys8///z++++PHz8+WuCDDz7o1avXiBEjwjvu9t9//2+//XbPH0x18uTJBS/QoEGDr7766ttvv61WrdqeecP86tWro/svypQp07lz5wIW7ty5c345MDyvBg0a9NRTT4WvHnHEET179mzcuPGmTZsmT5786quvppoWy5Qp07dv3zzfsF+/fvndMFm1atXwYY8ePaJfz7fffvvyyy/3NQ67TZKdYMSIEWEhf/bZZ8qEgoXDXbRv375WrVr//9pPdvayZcv2ut0Je7L16dNn927M22+/HX4eZ8+e7XwL/f3vfw/LZ8KECeGra9eujfVLnDdv3p6/U7E2rmbNms2ZMye2zPDhw2vUqHHQQQetXLnSaVBSBgwYEJb8tGnT0pcZO3Zs9BWX8vDDD++NOxu1Rua3p3u+8OvxtNNOi726fPny8DDdeOONO3zD+fPnV6hQIVzrr3/96/bt28NlVq5cmbp186mnnsrwi6gA69evL1euXPSLmZub62OIKvruosUS9ggvvfRS9HeXLl1mzJjx4osvJhKJrVu3vvHGG3kOaTBr1qzU92PFihX79OmT6uo2ffr0l19++bvv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mVKyH6jYDBBRF4BMFOcohOd8hw4dYleCRo8eHb5zFBcLVRqxzYt1qU0mk2+++Wb0au/evXcYLIuzvyUSLMMZFBOJRHQDaubBMs/vrqIVVGzLwwyZp+IEy1WrVpUtWzZ66c033wxzb9iCvXz58p13sL766qto+bPOOmuHwTI/3377bWr52GwlW7duLfIXUZ66d++e3+rRhdQKFSqoV6CKvrtkGb4Idq9w+sqwY1j58uXDuw3znOUyFFbxoxa2WJ01zxU7duyYPkrkypUrv/jii7DulT62Z1hbTSaTo0aNyvP9mzdvHrvHslq1ap06dQorZJs2bQoXaNCgQXoX1mbNmoUz3S1cuDAKzGH2Sx8GNlxrJ+1jfo444ojYvletWvWUU04JxxpJDfz4/vvvh7fhhd0jozLp2LFj9HDkyJH5/dNBgwalDxuTuRtuuOHkk08+9dRTe/fu/dxzz23cuDH1fMWKFYcOHRqOkbtixYqwAGONFammmLCdOTVvZOXKlcMjcvXVV//www8l+IEKR6RM1eYzX7ekjkLt2rVjZ13Y1pRIJKIJNgtVGu+9917YcfGoo46KLXDyySfHSnvX7G+RxT7m69evL9TqeX53Fbmgxo4dGz3ZqFGjWF/uklW1atVwCNawYMODctppp+2zzz4772CtXr063KSS/fRlZWXlN97yzhD1cI6+soBdT7CE3WnhwoXhaAexO47OPvvs6O+33nqrsL+XTZs2DSca+f777/NcLM+BKL788stkMhk9zHNkxRYtWoQXyMOMsUNh887WrVsXLVqUyVph596oBhO2ZDZp0iS8qalgO3sfM9n3jRs3phLypEmToicPPPDAPJNhOH7jkiVLYkOApNSsWTO/YTCLrFSpUt27d582bdqpp54aPp/qZBs97N+//3Fp3n333WiBX375JZFIZGdnH3300dGTkydPPvjggzt27PjSSy9Fk0+USP0yveq8QyV1FNLFbq+NrqQUqjTCa0PLly9PL+0wq6Qmfdld+5uhNWvWhA+jEJWh/AbRKVpBhc134UHZScILMak7kFN/Dx8+PM9ldsbB2rBhQ57friXy6du+fXvsKs9OFW1/qrOA2gXsFuaxhN3ptddei34C69atG1YLEonE6aefXqZMmdTdI2vWrBk+fHihJiQsXbp01apVV6xYUXANO89pIVMz8kXynHAyKyurVq1a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+sS2J3ZD79/+9rcilMa6devCTp5HHnnkqlWr0qfxvOaaa9555538pmMN57Eszv4WeR7Ln3766Q9/+EO4TOnSpT/99NMCfkPzm8cyv++uohXURx99FL75TTfdFC4/Y8aMK664IpxoNDaxZJ7zXuY3j2UkvBAW3vEYzQy5Uw9WMpkMQ3jsCzB9Hssbb7xxh2+4evXq/fbbL1zroIMOih3fCRMmpL4nK1asGM0yWvAXUcHC78C///3vKhioou8ugqWzlt2jV69e0RlSuXLlTZs25bfkkiVLwkvXd9xxR57Bsly5cnffffeXX375ww8/vP7667FOm+FvbYaVs8WLF4d34JQvX/6+++6bOHHiN998M3jw4EMPPTTPgJReyU5V7IYMGTJ79uzJkyffdNNN4e7Ur19/w4YNUY0zXKtfv36p57ds2TJ48ODYPCLRZm/durVevXrhS2edddbbb7/91ltv3XjjjelTU4bBsjj7mEmwTLUbDBs2bPbs2ZMmTbrmmmvCl+rXr5+bmxut+Oc//znWwjx06NBvv/12/PjxN954YzgQy/777x+eMDs1WK5ZsybWaJyaGiFl7dq1UYtH1Fo4dOjQSZMmjR49+k9/+lPUJty9e/fUNADRBh944IHDhg1LJbqlS5eGLerXXXddnqEo8b9znOzQtm3bwgao6DNywgkn9OjR4/jjj4/NL/roo48W8ygUOVgWqjQGDhwYvk+DBg0GDhz42WefTZgw4cUXX4watXJycsLjmF+wLM7+ZhgsO3TocNb/6tSpU55DuTz++OMF/4YWNlgWuaDC7iGpkp82bdqsWbMGDhyYav2rXbv2woULUwt/88034cLHHnvsq6++2rt376eeeirzYJlMJtPHPj3iiCPyXLLED1Yymbz33nujtR544IHiB8v85vs98MADu3btevrpp4dX6xKJxL777pv6Gox9EZ144oln5SOW+ZPJZDiuWPq1DFBFFyydtfyWrVmzJrxdsFevXgUvH46IUL9+/VQFPfP7LY877rioubJQlbN33303k3Hb07c/FizzU6pUqVhTbazOUa9evebNm+c5c3e42eHguulicxiEwbI4+5hhsCygz1iY0JLJ5ObNm/Mcyj+mfPnyX331VbjiTg2W6cW7//77R9cCksnk+PHjw5bk/JQpUyYVD2JzgVapUqVBgwZhnbhcuXJz586N3j82Umh6CMnPihUrWrVqlcmxaNGiRdSiVeSjULRgWdjS2L59++mnn57JTl144YWZBMsi72+GwbJgOTk5//znP3f4G1qEYFm0gpo2bdoOBxDq379/dPEiz476ZcuW/f777zMPlrEPYCKRGDhwYJ5LlvjBSv7fdtpWrVqVSLBMJpMvvPBChnN+RCdAejkUcKdG7Bpo2Oob/tiBKvou5h5L2A2GDBkSVjTPPPPMgpc/++yzo7/nz5//6aefpi+T36Cvbdq0GTFiRNGmN+zWrduIESPyzHWRa665puCb6+64445Y61DU/23QoEHh8DCpCne4qQsXLvz3v/+dGkf+jDPOyC9AXnjhhVdccUWeLx144IFffPFFAYPulMg+5ifPScxT9ekXX3yxY8eOsSdHjx59xhlnFPCG9erV+/TTT8PbSneBCy64IGxUmTNnTtiZuV27dh999FGsPTmmUaNG48aNS0XurKyssHPymjVrfv755+3bt0d14n/961+NGjUKO4KGb5X5jBTVq1cfN27cRRddVPBi55xzztixY6MTYBcfhcKWRqlSpYYMGRIbLzT9es3VV1/97LPPZhjtdtdZ17lz5ylTpsS6xZaUohVUixYt3nvvvfzmq8jKyrrjjjuizuFZWVnhrbCRTZs23XnnnZlvas+ePcNLM1lZWeedd94uO1jt27ePvqa+/PLLBQsWlEj5X3zxxcOHD4/1iY2pUaPGW2+9VYQTIBZZw37jXbt23Rlz+QKZkq1dDmHXO+mkk6IfyE6dOu2wz9LatWuPPvro6Iy65JJL0lssp0yZcumll4YTfzVq1GjAgAHptwVmftU/avm54447YtmsUqVKZ5111sSJE/NcJWq9qVev3rJly6ZPnx7tcqrm1KlTp/yuqY8ePfrwww8P/1fr1q2HDBmSTCY3bdrUunXr/Db7mWeeCesxNWvWvPPOO1OdrB555JGo6hZrsSzyPmbSYnnRRRcNHTo0jEbZ2dndunVLv4EqNGrUqE6dOsXmcDvssMP69++/fv369OV3dotlMpmcO3duVPKp5scffvghdlLdf//9sZGHc3Jy2rVr9/zzz8duNF2/fv1jjz0Wm/KuQoUKvXv3jtqmInPmzDnggAOihF+Ej9vnn3/+hz/8IbyBLZFIVKxYsVevXrFG4+IchSJ3hS1UaUQ++eSTLl26xCJQvXr1Lr300lmzZsUWLqDFssj7W4QWy/Llyzdq1Kh9+/YPPvjg119/nflvaBFaLItWUCk//vjjueeeGxZF1apVzzvvvOnTp6cv/Nxzz4VXVapWrXrdddctXbo08xbLZDLZpUuXaLFTTjllhztVUgcrJRyPNzwzi9NimbJu3boBAwaEP14phx9++EMPPbRs2bKCW24L6GIQrnjKKaeEIVMFA1X03ahUMhjsm5Ly/vvvh78Tn332WaEG5IRMvPnmm+GNmj/99FPDhg1zc3NnzpyZm5tbt27dxo0bZ9gZKUOLFi1avHjxhg0b9t1338aNGxd20rklS5b89NNPZcuWbdy4cayWn27+/Pnz5s0rX758/fr1Y31ZC7B9+/bvv/9++fLltWvXbtSoUSZdNEt2H1MtbNGg/xdddNGLL76YOjoLFiyoXLly48aNC56uPbJhw4Z58+YtW7asUqVK9erVy7wQdq/FixcvWrQoNze3Ro0ajRo1Kniy8mXLls2fP3/9+vX77LPPQQcdlN/x2rJly4wZM/bZZ5/YzbSFsm3btqVLly5atKhUqVK1a9euVatWntOi7sajkGFpxBrH5s6du2zZsgoVKtSqVSu/BqJLL730hRdeSP3duHHjH3/88Td21pVUQYXWrVs3e/bsdevW1axZ84ADDijgbNm2bdv06dNXrlxZo0aNQw45ZJe1mJXUwZowYULUw3b//ff//vvvS3wX1q5du3jx4hUrVuyzzz61a9fO8DswE7NmzYqu3NWrV2/evHmZfK5RRVdF30myFQH8llSoUCE2/kQJqlu3bnGmCKtdu/YO5w6J1K9fvwgz5mVlZRVzrPli7mN+GjVqFHZozET58uUPOeSQvW7o/Dp16sSG8ylAzZo1C+5Dm5KTkxNr0CuC0qVLF2rbdv1RyLA0QmXLls1k8+bOnRv9HQ6X+ps560qqoEKVKlXKsENp6dKlY50sdo2SOlht27Y98sgjU4Nyz5kzZ8SIEd26dSvZTa1cuXLlypV3RiE89thj0d9XXXWVVAm7l57oAPBb9tFHH0X9lCZPnqxAiAnHhn388cf3ls1etWpVNLdzlSpVrrvuOocSBEsAAHaP7t27RzN2zJw5c2/Z7Hnz5m3YsCH196233rrDOywAwRIAgJ3oqaeeKlWqVLt27caMGbO3bHOLFi2GDBlSt27dhg0bRqP1AruReyxhb9WgQYOePXtGDytWrKhM9gSdO3eObs1q27atAgH2fEcdddTnn3/etm3bkh3ybWc788wzTz311B9//LHgccIAwRIoyDHHHJPJZNnsYo8++qhCAPbG35S9cbMrVapU/MG9gBKhKywAAACCJQAAAIIlAAAAgiUAAACCJQAAAAiWAAAACJYAAAAIlgAAAAiWAAAAIFgCAAAgWAIAACBYAgAAIFgCAACAYAkAAIBgCQAAgGAJAACAYAkAAACCJQAAAIIlAAAAgiUAAACCJQAAAIIlAAAACJYAAAAIlgAAAAiWAAAACJYAAAAgWAIAACBYAgAAIFgCAAAgWAIAAIBgCQAAgGAJAACAYAkAAIBgCQAAAIIlAAAAgiUAAACCJQAAAIIlAAAAgiUAAAAIlgAAAAiWAAAACJYAAAAIlgAAACBYAgAAIFgCAAAgWAIAACBYAgAAgGAJAACAYAkAAIBgCQAAgGAJAAAAgiUAAACCJQAAAIIlAAAAgiUAAAAIlgAAAAiWAAAACJYAAAAIlgAAAAiWAAAAIFgCAAAgWAIAACBYAgAAIFgCAACAYAkAAIBgCQAAgGAJAACAYAkAAACCJQAAAIIlAAAAgiUAAACCJQAAAAiWAAAACJYAAAAIlgAAAAiWAAAACJYAAAAgWAIAACBYAgAAIFgCAAAgWAIAAIBgCQAAgGAJAACAYAkAAIBgCQAAAIIlAAAAgiUAAACCJQAAAIIlAAAACJYAAAAIlgAAAAiWAAAACJYAAAAIlgAAACBYAgAAIFgCAAAgWAIAACBYAgAAgGAJAACAYAkAAIBgCQAAgGAJAAAAgiUAAACCJQAAAIIlAAAAgiUAAAAIlgAAAAiWAAAACJYAAAAIlgAAACBYAgAAIFgCAAAgWAIAACBYAgAAIFgCAACAYAkAAIBgCQAAgGAJAACAYAkAAACCJQAAAIIlAAAAgiUAAACCJQAAAAiWAAAACJYAAAAIlgAAAAiWAAAAIFgCAAAgWAIAACBYAgAAIFgCAAAgWAIAAIBgCQAAgGAJAACAYAkAAIBgCQAAAIIlAAAAgiUAAACCJQAAAIIlAAAACJYAAAAIlgAAAAiWAAAACJYAAAAgWAIAACBYAgAAIFgCAAAgWAIAACBYAgAAgGAJAACAYAkAAIBgCQAAgGAJAAAAgiUAAACCJQAAAIIlAAAAgiUAAAAIlgAAAAiWAAAACJYAAAAIlgAAACBYAgAAIFgCAAAgWAIAACBYAgAAgGAJAACAYAkAAIBgCQAAgGAJAACAYAkAAACCJQAAAIIlAAAAgiUAAACCJQAAAAiWAAAACJYAAAAIlgAAAAiWAAAAIFgCAAAgWAIAACBYAgAAIFgCAACAYAkAAIBgCQAAgGAJAACAYAkAAIBgCQAAAIIlAAAAgiUAAACCJQAAAIIlAAAACJYAAAAIlgAAAAiWAAAACJYAAAAgWAIAACBYAgAAIFgCAAAgWAIAAIBgCQAAgGAJAACAYAkAAIBgCQAAgGCpCAAAABAsAQAAECwBAAAQLAEAABAsAQAAQLAEAABAsAQAAECwBAAAQLAEAAAAwRIAAADBEgAAAMESAAAAwRIAAAAESwAAAARLAAAABEsAAAAESwAAABAsAQAAECwBAAAQLAEAABAsAQAAECwBAABAsAQAAECwBAAAQLAEAABAsAQAAADBEgAAAMESAAAAwRIAAADBEgAAAARLAAAABEsAAAAESwAAAARLAAAAECwBAAAQLAEAABAsAQAAECwBAAAQLAEAAECwBAAAQLAEAABAsAQAAOA/TLYi2AXefffd6dOnKwcAANhd/v3vfysEwXLvNmDAAIUAAAD8VukKCwAAgGAJAACAYAkAAMBeqlQymVQKJS43N3fJkiXKAQAA9kx169YtV66cchAsAQAA2CPoCgsAAIBgCQAAgGAJAACAYAkAAIBgCQAAAIIlAAAAgiUAAACCJQAAAIIlAAAACJYAAAAIlgAAAAiWAAAACJYAAAAgWAIAACBYAgAAIFgCAAAgWAIAAIBgCQAAgGAJAACAYAkAAIBgCQAAgGAJAAAAgiUAAACCJQAAAIIlAAAAgiUAAAAIlgAAAAiWAAAACJYAAAAIlgAAACBYAgAAIFgCAAAgWAIAACBYAgAAgGAJAACAYAkAAIBgCQAAgGAJAACAYAkAAACCJQAAAIIlAAAAgiUAAACCJQAAAAiWAAAACJYAAAAIlgAAAAiWAAAAIFgCAAAgWAIAACBYAgAAIFgCAACAYAkAAIBgCQAAwB7j/wENKWXnkuVyLwAAAABJRU5ErkJggg==';
