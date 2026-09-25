import { Injectable, signal } from '@angular/core';
import { GeoLocation } from '../models/location.model';

const DB_NAME='2piclock';
const STORE='world-clocks';
const KEY='pinned-locations';

@Injectable({providedIn:'root'})
export class WorldClockPreferencesService {
  readonly pinnedLocations=signal<GeoLocation[]>([]);
  readonly hasSavedPreferences=signal(false);
  private dbPromise:Promise<IDBDatabase>|null=null;

  constructor(){ this.restore(); }

  add(location:GeoLocation):void {
    const current=this.pinnedLocations();
    if(current.some(x=>x.id===location.id)) return;
    const next=[...current,location];
    this.pinnedLocations.set(next);
    this.hasSavedPreferences.set(true);
    void this.persist(next);
  }

  remove(id:string):void {
    const next=this.pinnedLocations().filter(x=>x.id!==id);
    this.pinnedLocations.set(next);
    void this.persist(next);
  }

  reorder(from:number,to:number):void {
    const next=[...this.pinnedLocations()];
    const [item]=next.splice(from,1);
    if(!item) return;
    next.splice(to,0,item);
    this.pinnedLocations.set(next);
    void this.persist(next);
  }

  private async restore():Promise<void>{
    if(typeof indexedDB==='undefined') return;
    try{
      const db=await this.open();
      const locations=await new Promise<GeoLocation[]>((resolve,reject)=>{
        const request=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);
        request.onsuccess=()=>resolve(Array.isArray(request.result?.locations)?request.result.locations:[]);
        request.onerror=()=>reject(request.error);
      });
      this.pinnedLocations.set(locations);
      this.hasSavedPreferences.set(true);
    }catch{
      // The app continues with defaults if IndexedDB is unavailable.
    }
  }

  private async persist(locations:GeoLocation[]):Promise<void>{
    if(typeof indexedDB==='undefined') {
      try{ localStorage.setItem('2piclock-world-clocks',JSON.stringify(locations)); }catch{ /* ignore */ }
      return;
    }
    try{
      const db=await this.open();
      await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).put({id:KEY,locations});
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error);
      });
    }catch{
      try{ localStorage.setItem('2piclock-world-clocks',JSON.stringify(locations)); }catch{ /* ignore */ }
    }
  }

  private open():Promise<IDBDatabase>{
    if(this.dbPromise) return this.dbPromise;
    this.dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    return this.dbPromise;
  }
}