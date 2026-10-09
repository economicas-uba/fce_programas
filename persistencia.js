/* =========================================================
   Persistencia — Programas Académicos
   ---------------------------------------------------------
   Dos modos, elegidos solos al cargar la página:
     'api'   -> hay una API PHP en api/index.php (servidor de la Facultad).
                Los datos se comparten entre todos los usuarios de prueba.
     'local' -> no hay API (GitHub Pages, archivo abierto con doble clic):
                se usa el localStorage del navegador, como hasta ahora.
   Se puede forzar con ?modo=local o ?modo=api en la URL.

   En modo 'api' la app sigue trabajando sobre el objeto `db` en memoria.
   Cada vez que guarda, acá se compara contra lo último sincronizado y se
   mandan al servidor solo las diferencias: programas nuevos o modificados,
   tareas tomadas o liberadas, notificaciones nuevas y novedades vistas.
   Los envíos salen en orden, de a uno.
   Si otro usuario modificó lo mismo (el servidor responde 409), se avisa
   y se recargan los datos del servidor en lugar de pisar sus cambios.
   ========================================================= */
const Persistencia=(()=>{
  const API_URL='api/index.php';
  const STORAGE_KEY_LOCAL='pa_mock_data_v2';
  let modo='local', infoApi=null, deteccion=null;
  let foto=fotoVacia();                 // último estado sincronizado con el servidor
  let cola=Promise.resolve();           // envíos pendientes, en orden
  let obtenerDb=()=>null;               // la app indica cómo leer su `db` actual
  let alFallar=err=>console.error(err); // la app decide qué mostrar ante un error

  /* ---------- HTTP ---------- */
  function pedir(metodo,ruta,cuerpo){
    const op={method:metodo,credentials:'same-origin',headers:{}};
    if(cuerpo!==undefined){ op.headers['Content-Type']='application/json'; op.body=JSON.stringify(cuerpo); }
    return fetch(API_URL+'?r='+ruta,op).then(res=>res.text().then(txt=>{
      let datos=null; try{ datos=txt?JSON.parse(txt):null; }catch(e){}
      if(!res.ok || datos===null){
        const err=new Error((datos&&datos.error)||`El servidor respondió ${res.status}${datos===null?' (respuesta no JSON: ¿está PHP configurado?)':''}`);
        err.status=res.status; err.datos=datos; throw err;
      }
      return datos;
    }));
  }

  /* ---------- detección del modo ---------- */
  function detectar(){
    if(deteccion) return deteccion;
    const forzado=new URLSearchParams(location.search).get('modo');
    if(forzado==='local' || (location.protocol==='file:' && forzado!=='api')){ modo='local'; return deteccion=Promise.resolve(modo); }
    const limite=new Promise((_,rej)=>setTimeout(()=>rej(new Error('sin respuesta')),5000));
    deteccion=Promise.race([pedir('GET','ping'),limite])
      .then(info=>{ infoApi=info; modo='api'; console.info('Persistencia: API del servidor',info); return modo; })
      .catch(err=>{
        modo='local';
        if(forzado==='api') alert('Se pidió usar la API pero no responde: '+err.message+'. Se trabaja con datos locales.');
        console.info('Persistencia: localStorage del navegador (API no disponible: '+err.message+')');
        return modo;
      });
    return deteccion;
  }

  /* ---------- foto del último estado sincronizado ---------- */
  function fotoVacia(){ return {programas:new Map(),tomas:new Set(),notificaciones:new Set(),vistos:new Map()}; }
  /* _rev lo maneja el servidor: no cuenta como cambio del programa. */
  const firmaPrograma=p=>JSON.stringify(p,(k,v)=>k==='_rev'?undefined:v);
  const claveToma=t=>t.programa_id+'|'+t.tarea;
  function tomarFoto(db){
    foto=fotoVacia();
    (db.programs||[]).forEach(p=>foto.programas.set(p.id,firmaPrograma(p)));
    (db.tomas||[]).forEach(t=>foto.tomas.add(claveToma(t)));
    (db.notificaciones||[]).forEach(n=>foto.notificaciones.add(String(n.id)));
    Object.entries(db.vistos||{}).forEach(([u,v])=>foto.vistos.set(u,JSON.stringify(v)));
  }

  /* Calcula qué cambió desde la última foto y deja los envíos en la cola. */
  function sincronizar(db,usuarioId){
    const ops=[];
    const tomasActuales=new Map((db.tomas||[]).map(t=>[claveToma(t),t]));
    // Primero las tomas: si otro ya tomó la tarea, el resto del lote no se envía.
    tomasActuales.forEach((t,k)=>{ if(!foto.tomas.has(k)) ops.push({tipo:'tomar',toma:t}); });
    foto.tomas.forEach(k=>{ if(!tomasActuales.has(k)){ const [pid,...resto]=k.split('|'); ops.push({tipo:'liberar',programaId:pid,tarea:resto.join('|')}); } });

    const ids=new Set();
    (db.programs||[]).forEach(p=>{
      ids.add(p.id);
      const f=firmaPrograma(p);
      if(foto.programas.get(p.id)!==f){ ops.push({tipo:'programa',id:p.id}); foto.programas.set(p.id,f); }
    });
    foto.programas.forEach((_,id)=>{ if(!ids.has(id)){ ops.push({tipo:'borrarPrograma',id}); foto.programas.delete(id); } });

    (db.notificaciones||[]).forEach(n=>{ const k=String(n.id); if(!foto.notificaciones.has(k)){ ops.push({tipo:'notificacion',n}); foto.notificaciones.add(k); } });

    if(usuarioId && db.vistos && db.vistos[usuarioId]){
      const v=JSON.stringify(db.vistos[usuarioId]);
      if(foto.vistos.get(usuarioId)!==v){ ops.push({tipo:'vistos',usuarioId,datos:db.vistos[usuarioId]}); foto.vistos.set(usuarioId,v); }
    }
    foto.tomas=new Set(tomasActuales.keys());
    if(!ops.length) return cola;

    cola=cola.then(()=>ejecutar(ops)).catch(err=>{ alFallar(err); });
    return cola;
  }

  function ejecutar(ops){
    return ops.reduce((prom,op)=>prom.then(()=>{
      switch(op.tipo){
        case 'tomar': return pedir('POST','tomas',op.toma);
        case 'liberar': return pedir('DELETE',`tomas/${encodeURIComponent(op.programaId)}/${encodeURIComponent(op.tarea)}`);
        case 'programa': {
          // Se envía el programa tal como está al momento del envío, con su _rev vigente.
          const db=obtenerDb(), p=db&&(db.programs||[]).find(x=>x.id===op.id);
          if(!p) return;
          return pedir('PUT','programas/'+p.id,p).then(r=>{ p._rev=r._rev; });
        }
        case 'borrarPrograma': return pedir('DELETE','programas/'+op.id);
        case 'notificacion': return pedir('POST','notificaciones',op.n);
        case 'vistos': return pedir('PUT','vistos/'+encodeURIComponent(op.usuarioId),op.datos);
      }
    }),Promise.resolve());
  }

  /* ---------- interfaz pública ---------- */
  return {
    detectar,
    modo:()=>modo,
    esApi:()=>modo==='api',
    info:()=>infoApi,
    configurar(op){ if(op.obtenerDb) obtenerDb=op.obtenerDb; if(op.alFallar) alFallar=op.alFallar; },

    /* URL de un catálogo: por la API si está disponible, si no el JSON estático. */
    urlCatalogo(nombre,urlEstatica){ return modo==='api'?`${API_URL}?r=catalogos/${nombre}`:urlEstatica; },

    iniciarSesion(username,clave){ return modo==='api'?pedir('POST','sesion',{username,clave}):Promise.resolve(null); },
    cerrarSesion(){ return modo==='api'?cola.then(()=>pedir('DELETE','sesion')).catch(()=>{}):Promise.resolve(); },

    /* Estado completo desde el servidor. */
    cargar(){
      return pedir('GET','estado').then(d=>{
        const db={programs:d.programs||[],tomas:d.tomas||[],notificaciones:d.notificaciones||[],vistos:d.vistos||{}};
        tomarFoto(db);
        return db;
      });
    },
    /* Espera los envíos pendientes y vuelve a leer del servidor (null en modo local). */
    refrescar(){
      if(modo!=='api') return Promise.resolve(null);
      return cola.catch(()=>{}).then(()=>this.cargar());
    },

    guardar(db,usuarioId){
      if(modo==='api') return sincronizar(db,usuarioId);
      try{ localStorage.setItem(STORAGE_KEY_LOCAL,JSON.stringify(db)); }
      catch(e){ console.error('No se pudo guardar en localStorage',e); alert('No se pudieron guardar los cambios en este navegador.'); }
      return Promise.resolve();
    },
    leerLocal(){
      try{ const raw=localStorage.getItem(STORAGE_KEY_LOCAL); if(raw) return JSON.parse(raw); }
      catch(e){ console.error('No se pudo leer localStorage',e); }
      return null;
    },

    /* Id para un programa nuevo: lo asigna el servidor para que dos usuarios no generen el mismo. */
    reservarIdPrograma(db){
      if(modo!=='api'){ db.nextId=db.nextId||1; return Promise.resolve(db.nextId++); }
      return cola.catch(()=>{}).then(()=>pedir('POST','programas/reservar-id')).then(r=>r.id);
    },

    reiniciar(){ return cola.catch(()=>{}).then(()=>pedir('POST','estado/reiniciar')).then(()=>this.cargar()); },
    importar(datos){ return cola.catch(()=>{}).then(()=>pedir('POST','estado/importar',datos)).then(()=>this.cargar()); },
  };
})();
