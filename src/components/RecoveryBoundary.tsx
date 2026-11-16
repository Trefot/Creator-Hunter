import {Component,ReactNode} from 'react';
export class RecoveryBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return{failed:true}}
 render(){return this.state.failed?<main className="page"><section className="card" role="alert"><h1>No se pudo mostrar este apartado</h1><p>Tus registros guardados se conservan. Los formularios con recuperación mantienen su borrador en este equipo.</p><button onClick={()=>window.location.reload()}>Volver a abrir Nexus</button><p className="small muted">Si se repite, indica el apartado y exporta el diagnóstico desde Copias de seguridad.</p></section></main>:this.props.children}
}
